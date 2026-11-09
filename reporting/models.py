from django.conf import settings
from django.db import models


class ReportType(models.TextChoices):
    MESSAGE = "MESSAGE", "Message"
    URL = "URL", "URL"
    PHONE = "PHONE", "Phone number"


class ReportStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"


class CommunityReport(models.Model):
    # Only content the user deliberately reports is saved here.
    # Normal checks never create one of these.
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="community_reports",
    )
    report_type = models.CharField(max_length=10, choices=ReportType.choices)
    content = models.TextField()
    # Optional context from the reporter, e.g. where they received it.
    details = models.TextField(blank=True)
    status = models.CharField(
        max_length=10, choices=ReportStatus.choices, default=ReportStatus.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_report_type_display()} report #{self.pk} ({self.status})"


class ModerationDecision(models.TextChoices):
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"


class ModerationReview(models.Model):
    # OneToOne so a report can only get one final review in this MVP.
    report = models.OneToOneField(
        CommunityReport, on_delete=models.CASCADE, related_name="moderation_review"
    )
    # SET_NULL keeps the review history even if the moderator account is deleted later.
    moderator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="moderation_reviews",
    )
    decision = models.CharField(max_length=10, choices=ModerationDecision.choices)
    reason = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.decision} review of report #{self.report_id}"
