from unittest.mock import patch

from django.apps import apps
from django.db import DatabaseError
from rest_framework.test import APITestCase

from checking.models import PhoneReferenceRecord


def count_all_rows():
    # Total rows in every table, used to prove a check saved nothing.
    return sum(model.objects.count() for model in apps.get_models())


class CheckAPITests(APITestCase):
    def test_message_check_returns_result(self):
        response = self.client.post("/api/check/message/", {"message": "Act now before your account is blocked"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "SUCCESS")
        self.assertEqual(response.data["concern_level"], "CAUTION")
        self.assertEqual(response.data["indicators"][0]["type"], "urgency")
        self.assertTrue(response.data["explanation"])
        self.assertTrue(response.data["safer_action"])

    def test_check_does_not_need_login(self):
        response = self.client.post("/api/check/phone/", {"phone_number": "+250788123456"}, format="json")
        self.assertEqual(response.status_code, 200)

    def test_empty_message_is_invalid_input(self):
        response = self.client.post("/api/check/message/", {"message": "  "}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["status"], "INVALID_INPUT")
        self.assertIsNone(response.data["concern_level"])

    def test_missing_field_is_invalid_input(self):
        response = self.client.post("/api/check/url/", {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["status"], "INVALID_INPUT")

    def test_invalid_url_is_invalid_input(self):
        response = self.client.post("/api/check/url/", {"url": "not a url"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIsNone(response.data["concern_level"])

    def test_invalid_phone_is_invalid_input(self):
        response = self.client.post("/api/check/phone/", {"phone_number": "call me"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIsNone(response.data["concern_level"])

    def test_phone_reference_match(self):
        PhoneReferenceRecord.objects.create(phone_number="+250788000111")
        response = self.client.post("/api/check/phone/", {"phone_number": "+250 788-000-111"}, format="json")
        self.assertEqual(response.data["concern_level"], "HIGH_CONCERN")
        self.assertTrue(response.data["reference_match"])

    def test_lookup_failure_returns_check_unavailable(self):
        with patch("checking.reference_repository.approved_only", side_effect=DatabaseError("locked")):
            response = self.client.post("/api/check/url/", {"url": "https://www.example.com"}, format="json")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["status"], "CHECK_UNAVAILABLE")
        self.assertIsNone(response.data["concern_level"])
        self.assertIn("Do not rely on this check", response.data["safer_action"])

    def test_checked_content_is_not_persisted(self):
        before = count_all_rows()
        message = "PRIVATE-MARKER Dear customer, send your PIN now"
        self.client.post("/api/check/message/", {"message": message}, format="json")
        self.client.post("/api/check/url/", {"url": "http://private-marker.example"}, format="json")
        self.client.post("/api/check/phone/", {"phone_number": "+250788555444"}, format="json")
        self.assertEqual(count_all_rows(), before)
