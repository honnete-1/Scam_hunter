from django.contrib import admin, messages
from django.db.models import Count
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.urls import path, reverse
from django.utils.html import format_html

from .models import CommunityReport, ModerationReview, RemovalRequest, ReportType, ScamListRemoval
from .services import (
    ModerationError, accept_removal_request, approve_report, decline_removal_request, reject_report, remove_from_scam_list,
)


class ModerationReviewInline(admin.StackedInline):
    model = ModerationReview
    extra = 0
    can_delete = False
    readonly_fields = ("moderator", "decision", "reason", "reviewed_at")

    def has_add_permission(self, request, obj=None):
        # Reviews are only created through the approve/reject actions.
        return False


@admin.register(CommunityReport)
class CommunityReportAdmin(admin.ModelAdmin):
    list_display = ("id", "report_type", "short_content", "phone_number", "times_reported", "review_mode", "status",
                    "submitted_by", "created_at")
    list_filter = ("status", "review_mode", "report_type")
    # Searching "0788 123 456" or "+250788123456" finds the same number.
    search_fields = ("content", "phone_number")
    # Status is read-only so moderators can't skip the moderation service
    # (which is the only place that creates reference records).
    readonly_fields = ("status", "review_mode", "phone_number", "created_at", "updated_at")
    fields = ("submitted_by", "report_type", "content", "phone_number", "details", "review_mode", "status",
              "created_at", "updated_at")
    inlines = [ModerationReviewInline]
    actions = ["approve_selected", "reject_selected", "remove_selected_from_scam_list"]

    def get_queryset(self, request):
        # How many reports share each number, in any format (0788..., +250788..., 250788...).
        counts = (
            CommunityReport.objects.filter(report_type=ReportType.PHONE)
            .exclude(phone_number="")
            .values("phone_number")
            .annotate(total=Count("id"))
        )
        self._counts = {row["phone_number"]: row["total"] for row in counts}
        return super().get_queryset(request)

    def get_search_results(self, request, queryset, search_term):
        queryset, may_have_duplicates = super().get_search_results(request, queryset, search_term)
        from .models import phone_key

        number = phone_key(search_term) if search_term else ""
        if number:
            queryset |= self.model.objects.filter(phone_number=number)
        return queryset, may_have_duplicates

    @admin.display(description="Content")
    def short_content(self, obj):
        return obj.content[:60]

    @admin.display(description="Times reported")
    def times_reported(self, obj):
        if obj.report_type != ReportType.PHONE or not obj.phone_number:
            return "-"
        return getattr(self, "_counts", {}).get(obj.phone_number, 1)

    @admin.action(description="Approve selected pending reports")
    def approve_selected(self, request, queryset):
        self._moderate(request, queryset, approve_report, "approved")

    @admin.action(description="Reject selected pending reports (a rejected number leaves the scam list)")
    def reject_selected(self, request, queryset):
        self._moderate(request, queryset, reject_report, "rejected")

    @admin.action(description="Remove selected numbers/links from the scam list (all their reports)")
    def remove_selected_from_scam_list(self, request, queryset):
        # Undo for a wrong report, e.g. a direct report of an innocent number. Every report of the
        # same number, in any format, is taken off the list. History is kept.
        done = set()
        total = 0
        for report in queryset:
            key = report.phone_number or report.content
            if key in done:
                continue
            done.add(key)
            total += remove_from_scam_list(report, request.user, "Removed from the scam list by a moderator.")
        self.message_user(
            request, f"{len(done)} number(s)/link(s) taken off the scam list; {total} report(s) updated.", messages.SUCCESS,
        )

    def _moderate(self, request, queryset, action, verb):
        done = 0
        for report in queryset:
            try:
                action(report, request.user)
                done += 1
            except ModerationError as error:
                self.message_user(request, str(error), messages.WARNING)
        if done:
            self.message_user(request, f"{done} report(s) {verb}.", messages.SUCCESS)


@admin.register(ModerationReview)
class ModerationReviewAdmin(admin.ModelAdmin):
    list_display = ("report", "decision", "moderator", "reviewed_at")
    list_filter = ("decision",)
    readonly_fields = ("report", "moderator", "decision", "reviewed_at")

    def has_add_permission(self, request):
        return False


@admin.register(RemovalRequest)
class RemovalRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "phone_number", "full_name", "status", "proof_link", "created_at")
    list_filter = ("status",)
    search_fields = ("phone_number", "full_name", "contact")
    readonly_fields = ("submitted_by", "phone_number", "full_name", "contact", "explanation", "proof_link", "status",
                       "moderator", "created_at", "reviewed_at")
    fields = ("phone_number", "full_name", "contact", "explanation", "proof_link", "submitted_by", "status",
              "moderator_note", "moderator", "created_at", "reviewed_at")
    actions = ["accept_selected", "decline_selected"]

    def has_add_permission(self, request):
        # Requests come from the number owner through the website or the app.
        return False

    def get_urls(self):
        # The proof is private, so it is served only through the admin, to logged-in moderators.
        extra = [
            path("<int:pk>/proof/", self.admin_site.admin_view(self.proof_view), name="reporting_removalrequest_proof"),
        ]
        return extra + super().get_urls()

    def proof_view(self, request, pk):
        removal_request = get_object_or_404(RemovalRequest, pk=pk)
        if not removal_request.proof:
            raise Http404("No proof file.")
        return FileResponse(removal_request.proof.open("rb"), as_attachment=False)

    @admin.display(description="Proof")
    def proof_link(self, obj):
        if not obj.pk or not obj.proof:
            return "-"
        url = reverse("admin:reporting_removalrequest_proof", args=[obj.pk])
        return format_html('<a href="{}" target="_blank" rel="noopener">Open proof</a>', url)

    @admin.action(description="Accept: remove the number from the scam list")
    def accept_selected(self, request, queryset):
        self._review(request, queryset, accept_removal_request, "accepted; the numbers are off the scam list")

    @admin.action(description="Decline selected requests")
    def decline_selected(self, request, queryset):
        self._review(request, queryset, decline_removal_request, "declined")

    def _review(self, request, queryset, action, verb):
        done = 0
        for removal_request in queryset:
            try:
                action(removal_request, request.user)
                done += 1
            except ModerationError as error:
                self.message_user(request, str(error), messages.WARNING)
        if done:
            self.message_user(request, f"{done} removal request(s) {verb}.", messages.SUCCESS)


@admin.register(ScamListRemoval)
class ScamListRemovalAdmin(admin.ModelAdmin):
    list_display = ("phone_number", "moderator", "reports_removed", "reports_rejected", "removal_request", "removed_at")
    search_fields = ("phone_number",)
    readonly_fields = ("phone_number", "moderator", "reason", "removal_request", "reports_removed", "reports_rejected",
                       "removed_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
