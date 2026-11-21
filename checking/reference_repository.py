import re
from dataclasses import dataclass
from difflib import SequenceMatcher

from django.conf import settings
from django.db import DatabaseError
from django.db.models import Q

from reporting.models import CommunityReport, ReportStatus, ReportType

from .models import PhoneReferenceRecord, URLReferenceRecord
from .requests import CheckValidationError, extract_domain, normalize_phone_number, normalize_url

# Two messages this similar (0-1) are treated as the same scam template with small changes.
SIMILARITY_THRESHOLD = 0.6
MAX_REPORTS_TO_COMPARE = 500


def simplify(text):
    # Lowercase and hide numbers so "send 5,000 RWF" and "send 20,000 RWF" still look alike.
    return re.sub(r"\d[\d,.]*", "#", " ".join(text.lower().split()))


def message_similarity(first, second):
    return SequenceMatcher(None, simplify(first), simplify(second)).ratio()


def same_number(reported_content, phone_number):
    try:
        return normalize_phone_number(reported_content) == phone_number
    except CheckValidationError:
        return False


class LookupStatus:
    MATCH = "MATCH"
    NO_MATCH = "NO_MATCH"
    UNAVAILABLE = "UNAVAILABLE"


@dataclass
class LookupResult:
    # Using an explicit status means "no match" and "lookup failed"
    # can never be confused with each other (both would be None otherwise).
    status: str
    match: object = None
    error: str = ""

    @property
    def completed(self):
        return self.status != LookupStatus.UNAVAILABLE


def approved_only(queryset):
    # Only active records count. If a record came from a community report,
    # that report must be APPROVED. Pending or rejected reports never count.
    return queryset.filter(active=True).filter(
        Q(source_report__isnull=True) | Q(source_report__status=ReportStatus.APPROVED)
    )


def raise_if_outage_simulated():
    # Dev-only switch so the "check could not be completed" screen can be shown for real.
    if settings.SIMULATE_REFERENCE_OUTAGE:
        raise DatabaseError("Simulated reference outage.")


class ReferenceRepository:
    def find_url_match(self, url):
        url = normalize_url(url)
        domain = extract_domain(url)
        try:
            raise_if_outage_simulated()
            # A record matches either the exact URL or the same domain.
            record = approved_only(URLReferenceRecord.objects).filter(
                Q(url=url) | Q(domain=domain)
            ).first()
        except DatabaseError as error:
            return LookupResult(LookupStatus.UNAVAILABLE, error=str(error))
        return self._result_for(record)

    def find_phone_match(self, phone_number):
        # Normalize the number first so different formats can still match.
        phone_number = normalize_phone_number(phone_number)
        try:
            raise_if_outage_simulated()
            record = approved_only(PhoneReferenceRecord.objects).filter(
                phone_number=phone_number
            ).first()
        except DatabaseError as error:
            return LookupResult(LookupStatus.UNAVAILABLE, error=str(error))
        return self._result_for(record)

    def find_similar_reports(self, message):
        # Compares a message with APPROVED message reports. match = number of similar reports.
        try:
            raise_if_outage_simulated()
            reported = list(
                CommunityReport.objects.filter(report_type=ReportType.MESSAGE, status=ReportStatus.APPROVED)
                .order_by("-created_at")
                .values_list("content", flat=True)[:MAX_REPORTS_TO_COMPARE]
            )
        except DatabaseError as error:
            return LookupResult(LookupStatus.UNAVAILABLE, error=str(error))
        similar = sum(1 for content in reported if message_similarity(message, content) >= SIMILARITY_THRESHOLD)
        return LookupResult(LookupStatus.MATCH if similar else LookupStatus.NO_MATCH, match=similar)

    def phone_reputation(self, phone_number):
        # Like a caller-ID app: how many approved community reports name this number.
        phone_number = normalize_phone_number(phone_number)
        try:
            raise_if_outage_simulated()
            reports = CommunityReport.objects.filter(report_type=ReportType.PHONE, status=ReportStatus.APPROVED)
            dates = [report.created_at for report in reports if same_number(report.content, phone_number)]
        except DatabaseError as error:
            return LookupResult(LookupStatus.UNAVAILABLE, error=str(error))
        reputation = {"approved_reports": len(dates), "first_reported": min(dates).date().isoformat() if dates else None}
        return LookupResult(LookupStatus.MATCH if dates else LookupStatus.NO_MATCH, match=reputation)

    def _result_for(self, record):
        if record is None:
            return LookupResult(LookupStatus.NO_MATCH)
        return LookupResult(LookupStatus.MATCH, match=record)
