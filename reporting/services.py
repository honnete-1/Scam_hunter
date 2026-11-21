# Moderation workflow: submit -> PENDING -> moderator reviews -> APPROVED or REJECTED.
# Only approve_report() creates reference records, so only APPROVED reports affect matching.

from django.db import transaction
from django.utils import timezone

from checking.ai_analyzer import redact
from checking.models import PhoneReferenceRecord, ReferenceSource, URLReferenceRecord
from checking.requests import extract_domain, normalize_phone_number, normalize_url

from .models import CommunityReport, ModerationDecision, ModerationReview, ReportStatus, ReportType


class ModerationError(Exception):
    pass


def submit_report(user, report_type, content, details=""):
    # New reports always start as PENDING. They do nothing until a moderator approves them.
    return CommunityReport.objects.create(
        submitted_by=user,
        report_type=report_type,
        content=content.strip(),
        details=details.strip(),
        status=ReportStatus.PENDING,
    )


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

    ModerationReview.objects.create(
        report=report,
        moderator=moderator,
        decision=ModerationDecision.REJECTED,
        reason=reason or "",
    )
    report.status = ReportStatus.REJECTED
    report.save(update_fields=["status", "updated_at"])
    # Rejected reports never create a reference record.
    return report


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
        # make sure it is active again. The original source_report is kept.
        record.active = True
        record.approved_at = timezone.now()
        if record.source_report is None:
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
        .order_by("-moderation_review__reviewed_at")[:MAX_PUBLIC_ALERTS]
    )
    alerts = []
    for report in reports:
        # Links and numbers are the warning itself, so they stay. Message texts can contain the
        # victim's own details, so numbers and emails in them are hidden.
        content = redact(report.content) if report.report_type == ReportType.MESSAGE else report.content
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
