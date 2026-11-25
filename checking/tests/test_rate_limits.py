from django.contrib.auth.models import User
from django.core.cache import caches
from django.test import override_settings
from rest_framework.test import APITestCase

from config.throttling import rate_limit_message

LIMITS = {"check": "2/minute", "login": "2/minute", "register": "1/hour", "report": "1/hour"}
SCAM = "This is MTN Customer Care. Your account will be suspended. Reply with your OTP."


@override_settings(SCAM_HUNTER_RATE_LIMITS=LIMITS)
class RateLimitTests(APITestCase):
    def setUp(self):
        caches["rate_limits"].clear()

    def test_checks_are_limited_with_a_clear_message(self):
        for _ in range(2):
            self.assertEqual(self.client.post("/api/check/message/", {"message": SCAM}, format="json").status_code, 200)
        response = self.client.post("/api/check/url/", {"url": "https://example.com"}, format="json")
        self.assertEqual(response.status_code, 429)
        self.assertTrue(response.data["detail"].startswith("Too many requests."))

    def test_login_is_limited_to_slow_down_password_guessing(self):
        User.objects.create_user("dan", password="S4fe-enough-pass")
        for _ in range(2):
            self.client.post("/api/accounts/login/", {"username": "dan", "password": "guess"}, format="json")
        # Even the right password has to wait once the limit is reached.
        response = self.client.post("/api/accounts/login/", {"username": "dan", "password": "S4fe-enough-pass"}, format="json")
        self.assertEqual(response.status_code, 429)

    def test_sign_ups_are_limited(self):
        body = {"username": "erin", "password": "S4fe-enough-pass"}
        self.assertEqual(self.client.post("/api/accounts/register/", body, format="json").status_code, 201)
        body["username"] = "frank"
        self.assertEqual(self.client.post("/api/accounts/register/", body, format="json").status_code, 429)
        self.assertFalse(User.objects.filter(username="frank").exists())

    def test_reports_are_limited_per_account_but_reading_them_is_not(self):
        report = {"report_type": "MESSAGE", "content": SCAM, "details": "Got this today"}
        alice = User.objects.create_user("alice", password="S4fe-enough-pass")
        self.client.force_authenticate(alice)
        self.assertEqual(self.client.post("/api/reports/", report, format="json").status_code, 201)
        self.assertEqual(self.client.post("/api/reports/", report, format="json").status_code, 429)
        for _ in range(3):
            self.assertEqual(self.client.get("/api/reports/").status_code, 200)

        # Another account has its own limit.
        self.client.force_authenticate(User.objects.create_user("bob", password="S4fe-enough-pass"))
        self.assertEqual(self.client.post("/api/reports/", report, format="json").status_code, 201)

    @override_settings(SCAM_HUNTER_RATE_LIMITS={})
    def test_no_limit_when_none_is_set(self):
        for _ in range(4):
            self.assertEqual(self.client.post("/api/check/message/", {"message": SCAM}, format="json").status_code, 200)


class RateLimitMessageTests(APITestCase):
    def test_wait_time_is_said_in_plain_words(self):
        self.assertEqual(rate_limit_message(41.6), "Too many requests. Please wait 42 seconds and try again.")
        self.assertEqual(rate_limit_message(3000), "Too many requests. Please wait about 50 minutes and try again.")
        self.assertEqual(rate_limit_message(None), "Too many requests. Please wait a moment and try again.")
