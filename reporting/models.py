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
    # Was approved, then a moderator took the number or link off the scam list.
    REMOVED = "REMOVED", "Removed from list"


class ReviewMode(models.TextChoices):
    # MODERATED: a moderator approves or rejects it first (the default).
    # DIRECT: phone numbers only; approved automatically when submitted, so the number is blocked at once.
    MODERATED = "MODERATED", "Send for verification"
    DIRECT = "DIRECT", "Direct report"


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
    # Phone reports only: the number in one standard form (+2507XXXXXXXX for Rwanda), so
    # "0788 123 456" and "+250788123456" count as the same number. Filled in save().
    phone_number = models.CharField(max_length=16, blank=True, db_index=True)
    # Optional context from the reporter, e.g. where they received it.
    details = models.TextField(blank=True)
    status = models.CharField(
        max_length=10, choices=ReportStatus.choices, default=ReportStatus.PENDING
    )
    review_mode = models.CharField(
        max_length=10, choices=ReviewMode.choices, default=ReviewMode.MODERATED
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        self.phone_number = phone_key(self.content) if self.report_type == ReportType.PHONE else ""
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_report_type_display()} report #{self.pk} ({self.status})"


def phone_key(content):
    # The standard form of a reported number, or "" if it is not a valid number.
    from checking.requests import CheckValidationError, normalize_phone_number

    try:
        return normalize_phone_number(content)
    except CheckValidationError:
        return ""


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


class ScamListRemoval(models.Model):
    # History of numbers a moderator took off the scam list, and why. A cleared number is not
    # re-added by a direct report; new reports of it go to a moderator first.
    phone_number = models.CharField(max_length=16, db_index=True)
    moderator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="scam_list_removals"
    )
    reason = models.TextField(blank=True)
    removal_request = models.ForeignKey(
        "RemovalRequest", on_delete=models.SET_NULL, null=True, blank=True, related_name="removals"
    )
    reports_removed = models.PositiveIntegerField(default=0)
    reports_rejected = models.PositiveIntegerField(default=0)
    removed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-removed_at"]

    def __str__(self):
        return f"{self.phone_number} removed from the scam list"


class RemovalRequestStatus(models.TextChoices):
    PENDING = "PENDING", "Waiting for a moderator"
    ACCEPTED = "ACCEPTED", "Accepted: number removed"
    DECLINED = "DECLINED", "Declined"


def proof_upload_path(instance, filename):
    # The uploaded name is never used, so it cannot clash or carry a path. Only the extension is kept.
    import uuid
    from pathlib import Path

    return f"removal_proofs/{uuid.uuid4().hex}{Path(filename).suffix.lower()}"


class RemovalRequest(models.Model):
    # The owner of a reported number asks to be taken off the scam list, with proof such as a
    # letter stamped by MTN or Airtel. The proof file is private: only moderators can open it.
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="removal_requests"
    )
    phone_number = models.CharField(max_length=16, db_index=True)
    full_name = models.CharField(max_length=120)
    contact = models.CharField(max_length=120, help_text="How the moderator can reach the number owner.")
    explanation = models.TextField()
    proof = models.FileField(upload_to=proof_upload_path)
    status = models.CharField(
        max_length=10, choices=RemovalRequestStatus.choices, default=RemovalRequestStatus.PENDING
    )
    moderator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_removal_requests"
    )
    moderator_note = models.TextField(blank=True, help_text="Shown to the person who sent the request.")
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Removal request #{self.pk} for {self.phone_number} ({self.status})"


class StoredFile(models.Model):
    # The bytes of an uploaded file, used by reporting.storage.DatabaseStorage.
    name = models.CharField(max_length=255, unique=True)
    content = models.BinaryField()
    size = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
