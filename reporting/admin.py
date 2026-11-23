from django.contrib import admin, messages

from .models import CommunityReport, ModerationReview
from .services import ModerationError, approve_report, reject_report, remove_from_scam_list


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
    list_display = ("id", "report_type", "short_content", "review_mode", "status", "submitted_by", "created_at")
    list_filter = ("status", "review_mode", "report_type")
    search_fields = ("content",)
    # Status is read-only so moderators can't skip the moderation service
    # (which is the only place that creates reference records).
    readonly_fields = ("status", "review_mode", "created_at", "updated_at")
    fields = ("submitted_by", "report_type", "content", "details", "review_mode", "status", "created_at", "updated_at")
    inlines = [ModerationReviewInline]
    actions = ["approve_selected", "reject_selected", "remove_selected_from_scam_list"]

    @admin.display(description="Content")
    def short_content(self, obj):
        return obj.content[:60]

    @admin.action(description="Approve selected pending reports")
    def approve_selected(self, request, queryset):
        self._moderate(request, queryset, approve_report, "approved")

    @admin.action(description="Reject selected pending reports")
    def reject_selected(self, request, queryset):
        self._moderate(request, queryset, reject_report, "rejected")

    @admin.action(description="Remove selected numbers/links from the scam list")
    def remove_selected_from_scam_list(self, request, queryset):
        # Undo for a wrong report, e.g. a direct report of an innocent number. History is kept.
        removed = sum(remove_from_scam_list(report) for report in queryset)
        self.message_user(request, f"{removed} scam-list entr{'y' if removed == 1 else 'ies'} switched off.", messages.SUCCESS)

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
