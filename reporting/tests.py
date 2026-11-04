from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APITestCase

from checking.analysis_result import ConcernLevel
from checking.models import PhoneReferenceRecord, URLReferenceRecord
from checking.reference_repository import LookupStatus, ReferenceRepository
from checking.requests import PhoneCheck, URLCheck
from checking.services import AnalysisService

from .models import CommunityReport, ModerationDecision, ReportStatus, ReportType
from .services import ModerationError, approve_report, reject_report, submit_report


class ModerationServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("reporter", password="pass12345")
        self.moderator = User.objects.create_user("moderator", password="pass12345", is_staff=True)
        self.repository = ReferenceRepository()

    def test_new_report_starts_pending(self):
        report = submit_report(self.user, ReportType.URL, "http://fake-bank.example")
        self.assertEqual(report.status, ReportStatus.PENDING)

    def test_pending_report_is_not_used_as_reference(self):
        submit_report(self.user, ReportType.URL, "http://fake-bank.example")
        submit_report(self.user, ReportType.PHONE, "+250788000111")

        self.assertEqual(URLReferenceRecord.objects.count(), 0)
        self.assertEqual(PhoneReferenceRecord.objects.count(), 0)
        self.assertEqual(self.repository.find_url_match("http://fake-bank.example").status, LookupStatus.NO_MATCH)
        self.assertEqual(self.repository.find_phone_match("+250788000111").status, LookupStatus.NO_MATCH)

    def test_rejected_report_is_not_used_as_reference(self):
        report = submit_report(self.user, ReportType.PHONE, "+250788000111")
        reject_report(report, self.moderator, reason="Not enough evidence")

        report.refresh_from_db()
        self.assertEqual(report.status, ReportStatus.REJECTED)
        self.assertEqual(report.moderation_review.decision, ModerationDecision.REJECTED)
        self.assertEqual(PhoneReferenceRecord.objects.count(), 0)
        self.assertEqual(self.repository.find_phone_match("+250788000111").status, LookupStatus.NO_MATCH)

    def test_approved_url_report_creates_url_reference(self):
        report = submit_report(self.user, ReportType.URL, "  HTTP://Fake-Bank.example/login/  ")
        approve_report(report, self.moderator, reason="Confirmed phishing page")

        report.refresh_from_db()
        self.assertEqual(report.status, ReportStatus.APPROVED)
        self.assertEqual(report.moderation_review.moderator, self.moderator)

        record = URLReferenceRecord.objects.get()
        self.assertEqual(record.url, "http://fake-bank.example/login")
        self.assertEqual(record.domain, "fake-bank.example")
        # Traceability back to the report it came from.
        self.assertEqual(record.source_report, report)

        result = AnalysisService().analyze(URLCheck("fake-bank.example/login"))
        self.assertEqual(result.concern_level, ConcernLevel.HIGH_CONCERN)

    def test_approved_phone_report_creates_phone_reference(self):
        report = submit_report(self.user, ReportType.PHONE, "+250 788 000 111")
        approve_report(report, self.moderator)

        record = PhoneReferenceRecord.objects.get()
        self.assertEqual(record.phone_number, "+250788000111")
        self.assertEqual(record.source_report, report)

        result = AnalysisService().analyze(PhoneCheck("00250-788-000-111"))
        self.assertEqual(result.concern_level, ConcernLevel.HIGH_CONCERN)

    def test_approved_message_report_creates_no_reference(self):
        report = submit_report(self.user, ReportType.MESSAGE, "You won! Send your PIN.")
        approve_report(report, self.moderator)
        self.assertEqual(URLReferenceRecord.objects.count() + PhoneReferenceRecord.objects.count(), 0)

    def test_same_number_approved_twice_does_not_duplicate(self):
        first = submit_report(self.user, ReportType.PHONE, "+250788000111")
        second = submit_report(self.user, ReportType.PHONE, "0025 0788 000 111")
        approve_report(first, self.moderator)
        approve_report(second, self.moderator)

        self.assertEqual(PhoneReferenceRecord.objects.count(), 1)
        self.assertEqual(PhoneReferenceRecord.objects.get().source_report, first)

    def test_approving_reactivates_inactive_record(self):
        PhoneReferenceRecord.objects.create(phone_number="+250788000111", active=False)
        report = submit_report(self.user, ReportType.PHONE, "+250788000111")
        approve_report(report, self.moderator)
        self.assertTrue(PhoneReferenceRecord.objects.get().active)

    def test_report_cannot_be_reviewed_twice(self):
        report = submit_report(self.user, ReportType.PHONE, "+250788000111")
        reject_report(report, self.moderator)
        with self.assertRaises(ModerationError):
            approve_report(report, self.moderator)
        # The second attempt must not have sneaked a reference record in.
        self.assertEqual(PhoneReferenceRecord.objects.count(), 0)


class CommunityReportAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("reporter", password="pass12345")
        self.moderator = User.objects.create_user("moderator", password="pass12345", is_staff=True)

    def test_submitting_requires_login(self):
        response = self.client.post("/api/reports/", {"report_type": "PHONE", "content": "+250788000111"}, format="json")
        self.assertEqual(response.status_code, 401)

    def test_submitted_report_content_is_persisted(self):
        self.client.force_authenticate(self.user)
        content = "Dear customer, send your PIN to claim your prize"
        response = self.client.post("/api/reports/", {"report_type": "MESSAGE", "content": content}, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], "PENDING")
        report = CommunityReport.objects.get()
        self.assertEqual(report.content, content)
        self.assertEqual(report.submitted_by, self.user)

    def test_client_cannot_set_status(self):
        self.client.force_authenticate(self.user)
        self.client.post("/api/reports/", {"report_type": "PHONE", "content": "+250788000111", "status": "APPROVED"}, format="json")
        self.assertEqual(CommunityReport.objects.get().status, ReportStatus.PENDING)
        self.assertEqual(PhoneReferenceRecord.objects.count(), 0)

    def test_invalid_report_content_rejected(self):
        self.client.force_authenticate(self.user)
        response = self.client.post("/api/reports/", {"report_type": "URL", "content": "not a url"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(CommunityReport.objects.count(), 0)

    def test_user_only_sees_own_reports(self):
        other = User.objects.create_user("other", password="pass12345")
        submit_report(other, ReportType.PHONE, "+250788000111")
        submit_report(self.user, ReportType.PHONE, "+250788000222")

        self.client.force_authenticate(self.user)
        response = self.client.get("/api/reports/")
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["content"], "+250788000222")

    def test_only_staff_can_approve(self):
        report = submit_report(self.user, ReportType.PHONE, "+250788000111")
        self.client.force_authenticate(self.user)
        response = self.client.post(f"/api/reports/{report.pk}/approve/", {}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(PhoneReferenceRecord.objects.count(), 0)

    def test_moderator_can_approve_through_api(self):
        report = submit_report(self.user, ReportType.PHONE, "+250788000111")
        self.client.force_authenticate(self.moderator)
        response = self.client.post(f"/api/reports/{report.pk}/approve/", {"reason": "Many victims"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "APPROVED")
        self.assertEqual(PhoneReferenceRecord.objects.count(), 1)

        # Reviewing again is a conflict.
        response = self.client.post(f"/api/reports/{report.pk}/reject/", {}, format="json")
        self.assertEqual(response.status_code, 409)


class AdminTests(TestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser("admin", password="pass12345")
        self.client.force_login(self.admin_user)

    def test_admin_pages_load(self):
        for url in [
            "/admin/",
            "/admin/reporting/communityreport/",
            "/admin/reporting/moderationreview/",
            "/admin/checking/urlreferencerecord/",
            "/admin/checking/phonereferencerecord/",
            "/admin/checking/urlreferencerecord/add/",
        ]:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 200)

    def test_admin_approve_action_uses_moderation_service(self):
        report = submit_report(self.admin_user, ReportType.URL, "http://fake-bank.example")
        self.client.post(
            "/admin/reporting/communityreport/",
            {"action": "approve_selected", "_selected_action": [report.pk]},
        )
        report.refresh_from_db()
        self.assertEqual(report.status, ReportStatus.APPROVED)
        self.assertEqual(URLReferenceRecord.objects.get().source_report, report)
        self.assertEqual(self.client.get(f"/admin/reporting/communityreport/{report.pk}/change/").status_code, 200)
