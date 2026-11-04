from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from .requests import CheckValidationError, extract_domain, normalize_phone_number, normalize_url


class ReferenceSource(models.TextChoices):
    COMMUNITY_REPORT = "COMMUNITY_REPORT", "Approved community report"
    MODERATOR = "MODERATOR", "Added directly by a moderator"


# Parent for verified suspicious records. It is abstract, so Django makes
# one table per child (URL and phone) with these shared fields in each.
class ReferenceRecord(models.Model):
    source = models.CharField(
        max_length=20, choices=ReferenceSource.choices, default=ReferenceSource.MODERATOR
    )
    # Lets a moderator trace a record back to the approved report it came from.
    source_report = models.ForeignKey(
        "reporting.CommunityReport",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(class)s_set",
    )
    approved_at = models.DateTimeField(default=timezone.now)
    # Moderators can switch a record off instead of deleting it.
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True


class URLReferenceRecord(ReferenceRecord):
    # Unique on the normalized URL so the same link is never stored twice.
    url = models.CharField(max_length=2000, unique=True)
    domain = models.CharField(max_length=255, db_index=True)

    class Meta:
        verbose_name = "URL reference record"

    def clean(self):
        try:
            normalize_url(self.url)
        except CheckValidationError as error:
            raise ValidationError({"url": str(error)})

    def save(self, *args, **kwargs):
        # Always store the normalized form so lookups compare like with like.
        self.url = normalize_url(self.url)
        self.domain = extract_domain(self.url)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.url


class PhoneReferenceRecord(ReferenceRecord):
    phone_number = models.CharField(max_length=16, unique=True)

    class Meta:
        verbose_name = "phone reference record"

    def clean(self):
        try:
            normalize_phone_number(self.phone_number)
        except CheckValidationError as error:
            raise ValidationError({"phone_number": str(error)})

    def save(self, *args, **kwargs):
        self.phone_number = normalize_phone_number(self.phone_number)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.phone_number
