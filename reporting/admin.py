from django.contrib import admin, messages

from .models import CommunityReport, ModerationReview
from .services import ModerationError, approve_report, reject_report


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
    list_display = ("id", "report_type", "short_content", "status", "submitted_by", "created_at")
    list_filter = ("status", "report_type")
    search_fields = ("content",)
    # Status is read-only so moderators can't skip the moderation service
    # (which is the only place that creates reference records).
    readonly_fields = ("status", "created_at", "updated_at")
    inlines = [ModerationReviewInline]
    actions = ["approve_selected", "reject_selected"]

    @admin.display(description="Content")
    def short_content(self, obj):
        return obj.content[:60]

    @admin.action(description="Approve selected pending reports")
    def approve_selected(self, request, queryset):
        self._moderate(request, queryset, approve_report, "approved")

    @admin.action(description="Reject selected pending reports")
    def reject_selected(self, request, queryset):
        self._moderate(request, queryset, reject_report, "rejected")

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
