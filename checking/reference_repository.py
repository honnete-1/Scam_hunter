from dataclasses import dataclass

from django.db import DatabaseError
from django.db.models import Q

from reporting.models import ReportStatus

from .models import PhoneReferenceRecord, URLReferenceRecord
from .requests import extract_domain, normalize_phone_number, normalize_url


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


class ReferenceRepository:
    def find_url_match(self, url):
        url = normalize_url(url)
        domain = extract_domain(url)
        try:
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
            record = approved_only(PhoneReferenceRecord.objects).filter(
                phone_number=phone_number
            ).first()
        except DatabaseError as error:
            return LookupResult(LookupStatus.UNAVAILABLE, error=str(error))
        return self._result_for(record)

    def _result_for(self, record):
        if record is None:
            return LookupResult(LookupStatus.NO_MATCH)
        return LookupResult(LookupStatus.MATCH, match=record)
