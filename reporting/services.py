# Moderation workflow: submit -> PENDING -> moderator reviews -> APPROVED or REJECTED.
# Only approve_report() creates reference records, so only APPROVED reports affect matching.

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from checking.ai_analyzer import redact
from checking.reference_repository import approved_only
from checking.models import PhoneReferenceRecord, ReferenceSource, URLReferenceRecord
from checking.requests import CheckValidationError, extract_domain, normalize_phone_number, normalize_url

from .models import (
    CommunityReport, ModerationDecision, ModerationReview, RemovalRequest, RemovalRequestStatus, ReportStatus, ReportType,
    ReviewMode, ScamListRemoval,
)


class ModerationError(Exception):
    pass


# Direct reports skip the moderator, so each account may only make a few per day.
MAX_DIRECT_REPORTS_PER_DAY = 5
DIRECT_REPORT_REASON = "Direct report: approved automatically when it was submitted."
CLEARED_NUMBER_REASON = "The number was taken off the scam list by a moderator."


@transaction.atomic
def submit_report(user, report_type, content, details="", review_mode=ReviewMode.MODERATED):
    # New reports start as PENDING and do nothing until approved. A direct phone report is
    # approved straight away through the same approve_report() as a moderator would use,
    # unless a moderator already cleared that number: then a moderator must look at it again.
    if review_mode == ReviewMode.DIRECT and report_type == ReportType.PHONE and was_cleared(content):
        review_mode = ReviewMode.MODERATED
    report = CommunityReport.objects.create(
        submitted_by=user,
        report_type=report_type,
        content=content.strip(),
        details=details.strip(),
        status=ReportStatus.PENDING,
        review_mode=review_mode,
    )
    if review_mode == ReviewMode.DIRECT:
        if report_type != ReportType.PHONE:
            raise ModerationError("Only phone numbers can be reported directly.")
        report = approve_report(report, None, DIRECT_REPORT_REASON)
    return report


def direct_reports_today(user):
    since = timezone.now() - timedelta(days=1)
    return CommunityReport.objects.filter(submitted_by=user, review_mode=ReviewMode.DIRECT, created_at__gte=since).count()


def was_cleared(content):
    # True if a moderator took this number off the scam list and nobody has re-approved it since.
    try:
        number = normalize_phone_number(content)
    except CheckValidationError:
        return False
    return PhoneReferenceRecord.objects.filter(phone_number=number, active=False).exists()


@transaction.atomic
def clear_number(phone_number, moderator, reason="", removal_request=None):
    # Takes a number off the scam list completely, however many times and in whatever format it
    # was reported: every approved report of it becomes REMOVED, every pending one is rejected,
    # and the phone app stops flagging it at its next list update. History is kept.
    number = normalize_phone_number(phone_number)
    reason = reason or CLEARED_NUMBER_REASON
    PhoneReferenceRecord.objects.filter(phone_number=number).update(active=False)

    reports = CommunityReport.objects.select_for_update().filter(report_type=ReportType.PHONE, phone_number=number)
    removed = reports.filter(status=ReportStatus.APPROVED).update(status=ReportStatus.REMOVED, updated_at=timezone.now())
    rejected = 0
    for report in reports.filter(status=ReportStatus.PENDING):
        _record_review(report, moderator, ModerationDecision.REJECTED, reason, ReportStatus.REJECTED)
        rejected += 1

    return ScamListRemoval.objects.create(
        phone_number=number, moderator=moderator, reason=reason, removal_request=removal_request,
        reports_removed=removed, reports_rejected=rejected,
    )


@transaction.atomic
def remove_from_scam_list(report, moderator=None, reason=""):
    # Lets a moderator undo a wrong report (e.g. a direct one) without deleting any history.
    # Returns how many reports were taken off the list.
    if report.report_type == ReportType.PHONE:
        removal = clear_number(report.content, moderator, reason)
        return removal.reports_removed + removal.reports_rejected
    if report.report_type == ReportType.URL:
        url = normalize_url(report.content)
        URLReferenceRecord.objects.filter(url=url).update(active=False)
        removed = 0
        for other in CommunityReport.objects.filter(report_type=ReportType.URL, status=ReportStatus.APPROVED):
            if _same_url(other.content, url):
                other.status = ReportStatus.REMOVED
                other.save(update_fields=["status", "updated_at"])
                removed += 1
        return removed
    return 0


def _same_url(content, url):
    try:
        return normalize_url(content) == url
    except CheckValidationError:
        return False


@transaction.atomic
def accept_removal_request(request, moderator, note=""):
    request = RemovalRequest.objects.select_for_update().get(pk=request.pk)
    if request.status != RemovalRequestStatus.PENDING:
        raise ModerationError(f"Removal request #{request.pk} has already been reviewed.")
    note = note or request.moderator_note or "Your proof was accepted and the number was removed from the scam list."
    clear_number(request.phone_number, moderator, f"Removal request #{request.pk} accepted: {note}", request)
    return _close_removal_request(request, moderator, RemovalRequestStatus.ACCEPTED, note)


@transaction.atomic
def decline_removal_request(request, moderator, note=""):
    request = RemovalRequest.objects.select_for_update().get(pk=request.pk)
    if request.status != RemovalRequestStatus.PENDING:
        raise ModerationError(f"Removal request #{request.pk} has already been reviewed.")
    note = note or request.moderator_note or "The proof was not enough to remove this number from the scam list."
    return _close_removal_request(request, moderator, RemovalRequestStatus.DECLINED, note)


def _close_removal_request(request, moderator, status, note):
    request.status = status
    request.moderator = moderator
    request.moderator_note = note
    request.reviewed_at = timezone.now()
    request.save(update_fields=["status", "moderator", "moderator_note", "reviewed_at"])
    return request


def is_on_scam_list(phone_number):
    return approved_only(PhoneReferenceRecord.objects).filter(phone_number=phone_number).exists()


@transaction.atomic
def approve_report(report, moderator, reason=""):
    report = _lock_pending_report(report)

    ModerationReview.objects.create(
        report=report,
        moderator=moderator,
        decision=ModerationDecision.APPROVED,
        reason=reason or "",
    )
    report.status = ReportStatus.APPROVED
    report.save(update_fields=["status", "updated_at"])

    # Only now, after approval, can the report become reference data.
    create_reference_record(report)
    return report


@transaction.atomic
def reject_report(report, moderator, reason=""):
    report = _lock_pending_report(report)
    _record_review(report, moderator, ModerationDecision.REJECTED, reason, ReportStatus.REJECTED)
    # Rejected reports never create a reference record. Rejecting a phone number also clears it
    # from the scam list, even if other people reported it too (in any format).
    if report.report_type == ReportType.PHONE and report.phone_number:
        clear_number(report.phone_number, moderator, reason)
        report.refresh_from_db()
    return report


def _record_review(report, moderator, decision, reason, status):
    ModerationReview.objects.create(report=report, moderator=moderator, decision=decision, reason=reason or "")
    report.status = status
    report.save(update_fields=["status", "updated_at"])


def create_reference_record(report):
    # Safety check in case this is ever called from somewhere else.
    if report.status != ReportStatus.APPROVED:
        raise ModerationError("Only approved reports can create reference records.")

    if report.report_type == ReportType.URL:
        url = normalize_url(report.content)
        record, created = URLReferenceRecord.objects.get_or_create(
            url=url,
            defaults={
                "domain": extract_domain(url),
                "source": ReferenceSource.COMMUNITY_REPORT,
                "source_report": report,
            },
        )
    elif report.report_type == ReportType.PHONE:
        phone_number = normalize_phone_number(report.content)
        record, created = PhoneReferenceRecord.objects.get_or_create(
            phone_number=phone_number,
            defaults={
                "source": ReferenceSource.COMMUNITY_REPORT,
                "source_report": report,
            },
        )
    else:
        # Messages have no reference table yet, so approving one just marks it approved.
        return None

    if not created:
        # The same URL/number was already known. Instead of creating a duplicate,
        # make sure it is active again. The original source_report is kept while it is still approved;
        # if it was removed or rejected, this newly approved report becomes the source.
        record.active = True
        record.approved_at = timezone.now()
        if record.source_report is None or record.source_report.status != ReportStatus.APPROVED:
            record.source_report = report
        record.save()
    return record


def _lock_pending_report(report):
    # Re-read the report inside the transaction so two moderators
    # cannot review the same report at the same time.
    report = CommunityReport.objects.select_for_update().get(pk=report.pk)
    if report.status != ReportStatus.PENDING:
        raise ModerationError(f"Report #{report.pk} has already been reviewed ({report.status}).")
    return report


MAX_PUBLIC_ALERTS = 20


def public_alerts():
    # Recent APPROVED reports for the public "Scam alerts" feed. Pending or rejected
    # reports are never shown, and neither is who reported them.
    reports = (
        CommunityReport.objects.filter(status=ReportStatus.APPROVED)
        .select_related("moderation_review")
        .order_by("-moderation_review__reviewed_at")
    )
    alerts = []
    seen_numbers = set()
    for report in reports:
        if len(alerts) >= MAX_PUBLIC_ALERTS:
            break
        # A number reported several times (in any format) is shown once, in its standard form.
        if report.report_type == ReportType.PHONE and report.phone_number:
            if report.phone_number in seen_numbers:
                continue
            seen_numbers.add(report.phone_number)
        # Links and numbers are the warning itself, so they stay. Message texts can contain the
        # victim's own details, so numbers and emails in them are hidden.
        if report.report_type == ReportType.MESSAGE:
            content = redact(report.content)
        elif report.report_type == ReportType.PHONE and report.phone_number:
            content = report.phone_number
        else:
            content = report.content
        alerts.append({
            "id": report.id,
            "report_type": report.report_type,
            "content": content,
            "approved_at": report.moderation_review.reviewed_at,
        })
    return alerts


def community_stats():
    # Real numbers from the database only; nothing here is estimated or invented.
    approved = CommunityReport.objects.filter(status=ReportStatus.APPROVED)
    return {
        "approved_reports": approved.count(),
        "approved_by_type": {kind: approved.filter(report_type=kind).count() for kind in ReportType.values},
        "pending_reports": CommunityReport.objects.filter(status=ReportStatus.PENDING).count(),
        "suspicious_links": URLReferenceRecord.objects.filter(active=True).count(),
        "suspicious_numbers": PhoneReferenceRecord.objects.filter(active=True).count(),
    }


MAX_SCAM_NUMBERS = 5000


def scam_number_list():
    # Approved scam numbers for the phone app. It keeps a copy so incoming calls and SMS
    # can be checked instantly, even before the network answers.
    counts = {}
    phone_reports = CommunityReport.objects.filter(report_type=ReportType.PHONE, status=ReportStatus.APPROVED)
    for number in phone_reports.exclude(phone_number="").values_list("phone_number", flat=True):
        counts[number] = counts.get(number, 0) + 1

    records = approved_only(PhoneReferenceRecord.objects).order_by("-approved_at")[:MAX_SCAM_NUMBERS]
    numbers = [
        {"phone_number": record.phone_number, "reports": counts.get(record.phone_number, 0)}
        for record in records
    ]
    return {"generated_at": timezone.now(), "count": len(numbers), "numbers": numbers}
