import shutil
import tempfile

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APITestCase

from checking.models import PhoneReferenceRecord

from .models import CommunityReport, RemovalRequest, RemovalRequestStatus, ReportStatus, ReportType, ReviewMode, ScamListRemoval
from .services import (
    approve_report, clear_number, reject_report, remove_from_scam_list, submit_report,
)

PDF = b"%PDF-1.4\n% proof letter\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16


def scam_numbers(client):
    return [entry["phone_number"] for entry in client.get("/api/reports/scam-numbers/").data["numbers"]]


class SameNumberTests(APITestCase):
    # "0783 207 918", "+250783207918" and "250783207918" are one number everywhere.
    def setUp(self):
        self.users = [User.objects.create_user(f"user{i}", password="pass12345") for i in range(3)]
        self.moderator = User.objects.create_user("moderator", password="pass12345", is_staff=True)
        formats = ["0783 207 918", "+250783207918", "250783207918"]
        self.reports = [
            submit_report(user, ReportType.PHONE, number, review_mode=ReviewMode.DIRECT)
            for user, number in zip(self.users, formats)
        ]

    def test_reports_in_any_format_share_one_number(self):
        self.assertEqual({report.phone_number for report in self.reports}, {"+250783207918"})
        self.assertEqual(PhoneReferenceRecord.objects.count(), 1)
        numbers = self.client.get("/api/reports/scam-numbers/").data["numbers"]
        self.assertEqual(numbers, [{"phone_number": "+250783207918", "reports": 3}])

    def test_removing_one_report_removes_the_number_and_all_its_reports(self):
        remove_from_scam_list(self.reports[0], self.moderator)

        self.assertEqual(scam_numbers(self.client), [])
        self.assertFalse(PhoneReferenceRecord.objects.get().active)
        statuses = set(CommunityReport.objects.values_list("status", flat=True))
        self.assertEqual(statuses, {ReportStatus.REMOVED})
        removal = ScamListRemoval.objects.get()
        self.assertEqual((removal.reports_removed, removal.moderator), (3, self.moderator))

    def test_rejecting_a_pending_report_clears_the_number_and_rejects_the_others(self):
        other = User.objects.create_user("other", password="pass12345")
        pending = submit_report(other, ReportType.PHONE, "0783207918")
        second_pending = submit_report(self.users[0], ReportType.PHONE, "+250 783 207 918")

        reject_report(pending, self.moderator, "This is my cousin's number.")

        self.assertEqual(scam_numbers(self.client), [])
        second_pending.refresh_from_db()
        self.assertEqual(second_pending.status, ReportStatus.REJECTED)
        self.assertEqual(second_pending.moderation_review.reason, "This is my cousin's number.")
        self.assertEqual(CommunityReport.objects.filter(status=ReportStatus.REMOVED).count(), 3)

    def test_removed_numbers_leave_the_public_alerts(self):
        clear_number("0783207918", self.moderator)
        contents = [alert["content"] for alert in self.client.get("/api/reports/alerts/").data]
        self.assertEqual(contents, [])

    def test_a_cleared_number_cannot_be_re_added_by_a_direct_report(self):
        clear_number("0783207918", self.moderator)

        report = submit_report(self.users[1], ReportType.PHONE, "0783207918", review_mode=ReviewMode.DIRECT)

        self.assertEqual((report.status, report.review_mode), (ReportStatus.PENDING, ReviewMode.MODERATED))
        self.assertEqual(scam_numbers(self.client), [])
        # A moderator can still decide it is a scam after all.
        approve_report(report, self.moderator)
        self.assertEqual(scam_numbers(self.client), ["+250783207918"])


class MediaTestCase(APITestCase):
    def setUp(self):
        self.media = tempfile.mkdtemp()
        self.settings_override = override_settings(MEDIA_ROOT=self.media)
        self.settings_override.enable()
        self.reporter = User.objects.create_user("reporter", password="pass12345")
        self.owner = User.objects.create_user("owner", password="pass12345")
        self.moderator = User.objects.create_user("moderator", password="pass12345", is_staff=True, is_superuser=True)
        submit_report(self.reporter, ReportType.PHONE, "0788555666", review_mode=ReviewMode.DIRECT)

    def tearDown(self):
        self.settings_override.disable()
        shutil.rmtree(self.media, ignore_errors=True)

    def send(self, proof=None, **fields):
        body = {
            "phone_number": "+250 788 555 666",
            "full_name": "Aline Uwase",
            "contact": "aline@example.com",
            "explanation": "This is my business number. A customer reported it by mistake.",
            "proof": proof or SimpleUploadedFile("letter.pdf", PDF, content_type="application/pdf"),
            **fields,
        }
        return self.client.post("/api/reports/removal-requests/", body, format="multipart")


class RemovalRequestAPITests(MediaTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.owner)

    def test_owner_can_send_a_request_with_proof(self):
        response = self.send()

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["phone_number"], "+250788555666")
        self.assertEqual(response.data["status"], "PENDING")
        self.assertNotIn("proof", response.data)
        request = RemovalRequest.objects.get()
        self.assertTrue(request.proof.name.startswith("removal_proofs/"))
        self.assertNotIn("letter", request.proof.name)
        # Nothing changes until a moderator accepts it.
        self.assertEqual(scam_numbers(self.client), ["+250788555666"])
        self.assertEqual(self.client.get("/api/reports/removal-requests/").data[0]["id"], request.id)

    def test_login_is_required(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.send().status_code, 401)

    def test_proof_is_required(self):
        response = self.client.post(
            "/api/reports/removal-requests/",
            {"phone_number": "0788555666", "full_name": "A", "contact": "a@example.com", "explanation": "Mistake"},
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("proof", response.data)

    def test_only_images_and_pdfs_are_accepted(self):
        for name, content in [("letter.exe", b"MZ..."), ("letter.pdf", b"MZ not a pdf"), ("photo.png", PDF)]:
            with self.subTest(name=name):
                response = self.send(proof=SimpleUploadedFile(name, content))
                self.assertEqual(response.status_code, 400)
                self.assertIn("proof", response.data)
        self.assertEqual(self.send(proof=SimpleUploadedFile("photo.PNG", PNG)).status_code, 201)

    def test_large_files_are_refused(self):
        big = SimpleUploadedFile("letter.pdf", PDF + b"0" * (5 * 1024 * 1024))
        self.assertEqual(self.send(proof=big).status_code, 400)

    def test_number_must_be_on_the_scam_list(self):
        response = self.send(phone_number="0788000000")
        self.assertEqual(response.status_code, 400)
        self.assertIn("not on the scam list", str(response.data["phone_number"]))

    def test_one_pending_request_per_number(self):
        self.assertEqual(self.send().status_code, 201)
        response = self.send(phone_number="0788555666")
        self.assertEqual(response.status_code, 400)
        self.assertIn("already sent", str(response.data["phone_number"]))

    def test_users_only_see_their_own_requests(self):
        self.send()
        self.client.force_authenticate(self.reporter)
        self.assertEqual(self.client.get("/api/reports/removal-requests/").data, [])


class RemovalRequestAdminTests(MediaTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.owner)
        self.send()
        self.request = RemovalRequest.objects.get()
        self.client.force_authenticate(None)
        self.client.force_login(self.moderator)

    def test_accepting_removes_the_number_and_tells_the_owner(self):
        self.client.post(
            "/admin/reporting/removalrequest/", {"action": "accept_selected", "_selected_action": [self.request.pk]}
        )

        self.request.refresh_from_db()
        self.assertEqual(self.request.status, RemovalRequestStatus.ACCEPTED)
        self.assertEqual(self.request.moderator, self.moderator)
        self.assertIn("removed from the scam list", self.request.moderator_note)
        self.assertEqual(scam_numbers(self.client), [])
        self.assertEqual(CommunityReport.objects.get().status, ReportStatus.REMOVED)
        self.assertEqual(ScamListRemoval.objects.get().removal_request, self.request)

    def test_declining_keeps_the_number_on_the_list(self):
        self.client.post(
            "/admin/reporting/removalrequest/", {"action": "decline_selected", "_selected_action": [self.request.pk]}
        )
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, RemovalRequestStatus.DECLINED)
        self.assertEqual(scam_numbers(self.client), ["+250788555666"])

    def test_moderators_can_open_the_proof_but_nobody_else(self):
        url = f"/admin/reporting/removalrequest/{self.request.pk}/proof/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(b"".join(response.streaming_content), PDF)
        self.assertEqual(self.client.get(f"/admin/reporting/removalrequest/{self.request.pk}/change/").status_code, 200)

        self.client.logout()
        self.client.force_login(self.owner)
        self.assertNotEqual(self.client.get(url).status_code, 200)

    def test_admin_remove_action_clears_every_format(self):
        submit_report(self.reporter, ReportType.PHONE, "+250788555666")
        report = CommunityReport.objects.filter(status=ReportStatus.APPROVED).get()
        self.client.post(
            "/admin/reporting/communityreport/",
            {"action": "remove_selected_from_scam_list", "_selected_action": [report.pk]},
        )
        self.assertEqual(scam_numbers(self.client), [])
        self.assertEqual(
            set(CommunityReport.objects.values_list("status", flat=True)), {ReportStatus.REMOVED, ReportStatus.REJECTED}
        )

    def test_admin_lists_load_and_search_matches_any_format(self):
        for url in ["/admin/reporting/removalrequest/", "/admin/reporting/scamlistremoval/"]:
            self.assertEqual(self.client.get(url).status_code, 200)
        response = self.client.get("/admin/reporting/communityreport/", {"q": "0788 555 666"})
        self.assertContains(response, "+250788555666")
