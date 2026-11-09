from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework.test import APITestCase

from checking.models import PhoneReferenceRecord, URLReferenceRecord

from .models import CommunityReport, ReportStatus


# These tests call the API in the same order the web app does, from checking to moderation.
class WebFlowTests(APITestCase):
    def check(self, kind, field, value):
        return self.client.post(f"/api/check/{kind}/", {field: value}, format="json")

    def sign_up_and_log_in(self, username):
        self.client.post(
            "/api/accounts/register/",
            {"username": username, "password": "Report3r-pass!"},
            format="json",
        )
        response = self.client.post(
            "/api/accounts/login/", {"username": username, "password": "Report3r-pass!"}, format="json"
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {response.data['token']}")

    def moderate(self, report_id, decision):
        moderator = User.objects.create_user(f"mod-{report_id}", password="x", is_staff=True)
        self.client.force_authenticate(moderator)
        response = self.client.post(f"/api/reports/{report_id}/{decision}/", {}, format="json")
        self.client.force_authenticate(None)
        return response

    def test_empty_input_is_a_validation_error(self):
        response = self.check("message", "message", "   ")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["errors"]["message"], ["Please enter a message before checking."])

    def test_concern_levels_from_messages(self):
        self.assertEqual(self.check("message", "message", "Reply immediately").data["concern_level"], "CAUTION")

        three_signs = "Congratulations, you have won! Send your PIN and pay the processing fee immediately."
        self.assertEqual(self.check("message", "message", three_signs).data["concern_level"], "HIGH_CONCERN")

        clean = self.check("message", "message", "Lunch at 1pm tomorrow?").data
        self.assertEqual(clean["concern_level"], "NO_KNOWN_WARNING_SIGNS")
        self.assertIn("does not guarantee", clean["explanation"])

    @override_settings(SIMULATE_REFERENCE_OUTAGE=True)
    def test_outage_gives_check_unavailable(self):
        for kind, field, value in [("url", "url", "https://example.com"), ("phone", "phone_number", "+250788123456")]:
            response = self.check(kind, field, value)
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.data["status"], "CHECK_UNAVAILABLE")
            self.assertIsNone(response.data["concern_level"])
            # The internal error text must not leak to the user.
            self.assertNotIn("outage", str(response.data).lower())

    def test_report_moderation_and_future_checks(self):
        self.check("url", "url", "http://pay-fee-now.example/claim")
        self.assertEqual(CommunityReport.objects.count(), 0)

        self.sign_up_and_log_in("reporter")
        first = self.client.post(
            "/api/reports/",
            {"report_type": "URL", "content": "http://pay-fee-now.example/claim", "details": "Came by SMS"},
            format="json",
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.data["status"], "PENDING")
        self.assertEqual(CommunityReport.objects.get().details, "Came by SMS")

        # Pending report: no influence on checks.
        self.assertEqual(self.check("url", "url", "pay-fee-now.example/claim").data["concern_level"], "NO_KNOWN_WARNING_SIGNS")

        # Rejected report: still no influence.
        self.assertEqual(self.moderate(first.data["id"], "reject").status_code, 200)
        self.assertEqual(URLReferenceRecord.objects.count(), 0)
        self.assertFalse(self.check("url", "url", "pay-fee-now.example/claim").data["reference_match"])

        # Approved report: creates a record and future checks become HIGH_CONCERN.
        self.sign_up_and_log_in("second-reporter")
        second = self.client.post(
            "/api/reports/", {"report_type": "URL", "content": "https://pay-fee-now.example/claim"}, format="json"
        )
        self.assertEqual(self.moderate(second.data["id"], "approve").status_code, 200)
        self.assertEqual(URLReferenceRecord.objects.count(), 1)

        result = self.check("url", "url", "pay-fee-now.example/other-page").data
        self.assertEqual(result["concern_level"], "HIGH_CONCERN")
        self.assertTrue(result["reference_match"])

    def test_approved_phone_report_affects_future_checks(self):
        self.sign_up_and_log_in("reporter")
        report = self.client.post("/api/reports/", {"report_type": "PHONE", "content": "+250 788 444 333"}, format="json")
        self.assertEqual(self.check("phone", "phone_number", "0025 0788 444 333").data["concern_level"], "NO_KNOWN_WARNING_SIGNS")

        self.moderate(report.data["id"], "approve")
        self.assertEqual(CommunityReport.objects.get().status, ReportStatus.APPROVED)
        self.assertEqual(PhoneReferenceRecord.objects.count(), 1)
        self.assertEqual(self.check("phone", "phone_number", "0025 0788 444 333").data["concern_level"], "HIGH_CONCERN")
