import json
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import DatabaseError
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APITestCase

from checking.ai_analyzer import AIAnalyzer, AIAssessment, CheckStatus, redact
from checking.analysis_result import ConcernLevel, ResultStatus
from checking.external import ExternalServiceError
from checking.models import URLReferenceRecord
from checking.requests import MessageCheck, PhoneCheck, URLCheck
from checking.services import AnalysisService
from checking.threat_intel import (
    OnlineCheck, check_domain_age, check_safe_browsing, check_urlhaus, extract_links, registrable_domain,
)
from reporting.models import ReportType
from reporting.services import approve_report, submit_report

ONLINE = {"ONLINE_CHECKS_ENABLED": True, "AI_API_KEY": "test-key", "GOOGLE_SAFE_BROWSING_API_KEY": "gkey",
          "URLHAUS_AUTH_KEY": "ukey"}


def ai_reply(scam_likely, confidence, reason="Asks for a code."):
    content = json.dumps({"scam_likely": scam_likely, "confidence": confidence, "reason": reason})
    return {"choices": [{"message": {"content": content}}]}


class FakeAI:
    def __init__(self, assessment):
        self.assessment = assessment
        self.seen = None

    def analyze(self, message):
        self.seen = message
        return self.assessment


def no_link_checks(url, domain):
    return []


def service(ai=None, link_checker=no_link_checks):
    return AnalysisService(ai_analyzer=ai or FakeAI(AIAssessment(CheckStatus.NOT_CONFIGURED)), link_checker=link_checker)


class RedactionTests(SimpleTestCase):
    def test_personal_details_are_removed(self):
        text = redact("Call +250 788 123 456 or mail jean@example.com, your code is 482913.")
        self.assertNotIn("788", text)
        self.assertNotIn("jean@example.com", text)
        self.assertNotIn("482913", text)
        self.assertIn("[number]", text)
        self.assertIn("[email]", text)
        self.assertIn("[code]", text)

    def test_amounts_are_kept_for_context(self):
        self.assertEqual(redact("Send 20000 RWF or 50k now"), "Send 20000 RWF or 50k now")


class AIAnalyzerTests(SimpleTestCase):
    def test_not_configured_without_a_key(self):
        with override_settings(ONLINE_CHECKS_ENABLED=True, AI_API_KEY=""):
            self.assertEqual(AIAnalyzer().analyze("hello").status, CheckStatus.NOT_CONFIGURED)

    @override_settings(**ONLINE)
    def test_sends_redacted_text_and_reads_the_json_answer(self):
        with patch("checking.ai_analyzer.request_json", return_value=ai_reply(True, 0.9)) as mock:
            result = AIAnalyzer().analyze("Send me the code 482913 now")

        body = mock.call_args.kwargs["json_body"]
        self.assertEqual(body["response_format"], {"type": "json_object"})
        self.assertNotIn("482913", body["messages"][1]["content"])
        self.assertEqual(mock.call_args.kwargs["headers"]["Authorization"], "Bearer test-key")
        self.assertEqual(result.status, CheckStatus.COMPLETED)
        self.assertTrue(result.flags_message)

    @override_settings(**ONLINE)
    def test_low_confidence_does_not_flag(self):
        with patch("checking.ai_analyzer.request_json", return_value=ai_reply(True, 0.4)):
            self.assertFalse(AIAnalyzer().analyze("hello").flags_message)

    @override_settings(**ONLINE)
    def test_service_failure_or_unreadable_answer_is_unavailable(self):
        with patch("checking.ai_analyzer.request_json", side_effect=ExternalServiceError("HTTP 429")):
            self.assertEqual(AIAnalyzer().analyze("hello").status, CheckStatus.UNAVAILABLE)
        with patch("checking.ai_analyzer.request_json", return_value={"choices": [{"message": {"content": "not json"}}]}):
            self.assertEqual(AIAnalyzer().analyze("hello").status, CheckStatus.UNAVAILABLE)


class LinkCheckTests(SimpleTestCase):
    def test_links_are_found_in_message_text(self):
        links = extract_links("Verify at bk-help.com/login or https://bit.ly/x1, thanks. Meet at 3pm.")
        self.assertEqual(links, ["http://bk-help.com/login", "https://bit.ly/x1"])
        self.assertEqual(extract_links("No links here, just a normal message."), [])

    def test_registrable_domain(self):
        self.assertEqual(registrable_domain("secure.login.bk-help.com"), "bk-help.com")
        self.assertEqual(registrable_domain("mail.example.co.rw"), "example.co.rw")

    def test_checks_are_not_configured_without_keys(self):
        with override_settings(ONLINE_CHECKS_ENABLED=True, GOOGLE_SAFE_BROWSING_API_KEY="", URLHAUS_AUTH_KEY=""):
            self.assertEqual(check_safe_browsing("http://x.com").status, CheckStatus.NOT_CONFIGURED)
            self.assertEqual(check_urlhaus("x.com").status, CheckStatus.NOT_CONFIGURED)

    @override_settings(**ONLINE)
    def test_safe_browsing_match(self):
        reply = {"matches": [{"threatType": "SOCIAL_ENGINEERING", "threat": {"url": "http://x.com"}}]}
        with patch("checking.threat_intel.request_json", return_value=reply):
            check = check_safe_browsing("http://x.com")
        self.assertTrue(check.finding)
        self.assertIn("social engineering", check.detail)
        with patch("checking.threat_intel.request_json", return_value={}):
            self.assertFalse(check_safe_browsing("http://x.com").finding)

    @override_settings(**ONLINE)
    def test_urlhaus_host_listing(self):
        with patch("checking.threat_intel.request_json", return_value={"query_status": "ok", "url_count": "4"}) as mock:
            check = check_urlhaus("evil.example")
        self.assertEqual(mock.call_args.kwargs["headers"], {"Auth-Key": "ukey"})
        self.assertTrue(check.finding)
        with patch("checking.threat_intel.request_json", return_value={"query_status": "no_results"}):
            check = check_urlhaus("fine.example")
        self.assertEqual(check.status, CheckStatus.COMPLETED)
        self.assertFalse(check.finding)

    @override_settings(**ONLINE)
    def test_domain_age(self):
        def rdap(days_old):
            date = (datetime.now(timezone.utc) - timedelta(days=days_old)).strftime("%Y-%m-%dT%H:%M:%SZ")
            return {"events": [{"eventAction": "registration", "eventDate": date}]}

        with patch("checking.threat_intel.request_json", return_value=rdap(3)):
            self.assertTrue(check_domain_age("new-scam.com").finding)
        with patch("checking.threat_intel.request_json", return_value=rdap(4000)):
            self.assertFalse(check_domain_age("old-site.com").finding)
        with patch("checking.threat_intel.request_json", side_effect=ExternalServiceError("HTTP 404")):
            self.assertEqual(check_domain_age("unknown.com").status, CheckStatus.UNAVAILABLE)


class LayeredAnalysisTests(TestCase):
    def test_ai_counts_as_one_extra_category_and_thresholds_stay_the_same(self):
        flagged = FakeAI(AIAssessment(CheckStatus.COMPLETED, True, 0.92, "Looks like a fake prize."))
        result = service(flagged).analyze(MessageCheck("Hello, nice to meet you"))
        self.assertEqual(result.distinct_indicator_types(), ["ai_assessment"])
        self.assertEqual(result.concern_level, ConcernLevel.CAUTION)

        # Two rule categories + AI = 3 distinct categories = High Concern.
        result = service(flagged).analyze(MessageCheck("Reply with your PIN immediately"))
        self.assertEqual(len(result.distinct_indicator_types()), 3)
        self.assertEqual(result.concern_level, ConcernLevel.HIGH_CONCERN)

    def test_ai_score_is_the_models_own_scam_likelihood(self):
        flagged = FakeAI(AIAssessment(CheckStatus.COMPLETED, True, 0.9, "Fake prize."))
        self.assertEqual(service(flagged).analyze(MessageCheck("Hello")).to_dict()["ai_score"], 90)

        calm = FakeAI(AIAssessment(CheckStatus.COMPLETED, False, 0.97, "Normal."))
        self.assertEqual(service(calm).analyze(MessageCheck("Hello")).to_dict()["ai_score"], 3)

        # No AI result means no score at all, never a made-up number.
        missing = FakeAI(AIAssessment(CheckStatus.UNAVAILABLE))
        self.assertIsNone(service(missing).analyze(MessageCheck("Hello")).to_dict()["ai_score"])

    def test_ai_saying_safe_never_removes_rule_findings(self):
        calm_ai = FakeAI(AIAssessment(CheckStatus.COMPLETED, False, 0.99, "Looks normal."))
        result = service(calm_ai).analyze(MessageCheck("Reply with your PIN immediately"))
        self.assertEqual(result.concern_level, ConcernLevel.CAUTION)
        self.assertIn("sensitive_information_request", result.distinct_indicator_types())

    def test_ai_unavailable_is_shown_and_never_hidden(self):
        result = service(FakeAI(AIAssessment(CheckStatus.UNAVAILABLE))).analyze(MessageCheck("See you at 3pm"))
        self.assertEqual(result.status, ResultStatus.SUCCESS)
        ai_check = next(check for check in result.checks if check["id"] == "ai")
        self.assertEqual(ai_check["status"], CheckStatus.UNAVAILABLE)
        self.assertIn("Some online checks could not run", result.explanation)

    def test_link_in_message_matching_an_approved_record_is_high_concern(self):
        URLReferenceRecord.objects.create(url="http://pay-fee-now.example/claim")
        result = service().analyze(MessageCheck("Your parcel is waiting, open https://pay-fee-now.example/claim"))
        self.assertEqual(result.concern_level, ConcernLevel.HIGH_CONCERN)
        self.assertTrue(result.to_dict()["reference_match"])

    def test_link_lookup_failure_in_message_is_check_unavailable(self):
        with patch("checking.reference_repository.approved_only", side_effect=DatabaseError("locked")):
            result = service().analyze(MessageCheck("Open https://example.com/win now"))
        self.assertEqual(result.status, ResultStatus.CHECK_UNAVAILABLE)
        self.assertIsNone(result.concern_level)

    def test_online_link_findings_become_categories(self):
        def harmful(url, domain):
            return [
                OnlineCheck("safe_browsing", "Google Safe Browsing", CheckStatus.COMPLETED, True, "Listed by Google as malware"),
                OnlineCheck("domain_age", "Website age", CheckStatus.COMPLETED, True, "Registered 2 day(s) ago"),
            ]

        result = service(link_checker=harmful).analyze(URLCheck("https://secure-login.example/start"))
        types = result.distinct_indicator_types()
        self.assertIn("known_malicious_link", types)
        self.assertIn("new_domain", types)
        self.assertIn("suspicious_domain_word", types)
        self.assertEqual(result.concern_level, ConcernLevel.HIGH_CONCERN)
        labels = {check["id"]: check for check in result.checks}
        self.assertTrue(labels["safe_browsing"]["finding"])

    def test_similar_to_approved_message_report(self):
        user = User.objects.create_user("reporter", password="x")
        moderator = User.objects.create_user("mod", password="x", is_staff=True)
        scam = "Congratulations! Your SIM won 500,000 RWF in the MTN promo. Call 0788000111 to claim it."
        approve_report(submit_report(user, ReportType.MESSAGE, scam), moderator)
        # A pending report with the same text must not count.
        submit_report(user, ReportType.MESSAGE, "Totally different pending text about a bank loan offer")

        variant = "Congratulations! Your SIM won 300,000 RWF in the MTN promo. Call 0789999222 to claim it."
        result = service().analyze(MessageCheck(variant))
        self.assertIn("similar_to_reported", result.distinct_indicator_types())

        unrelated = service().analyze(MessageCheck("Totally different pending text about a bank loan offer"))
        self.assertNotIn("similar_to_reported", unrelated.distinct_indicator_types())

    def test_phone_reputation_counts_only_approved_reports(self):
        user = User.objects.create_user("reporter", password="x")
        moderator = User.objects.create_user("mod", password="x", is_staff=True)
        approve_report(submit_report(user, ReportType.PHONE, "0788 555 123"), moderator)
        submit_report(user, ReportType.PHONE, "+250788555123")  # still pending

        result = service().analyze(PhoneCheck("+250 788 555 123"))
        self.assertEqual(result.concern_level, ConcernLevel.HIGH_CONCERN)
        self.assertEqual(result.reputation["approved_reports"], 1)
        self.assertIsNotNone(result.reputation["first_reported"])


class PublicCommunityAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("reporter", password="x")
        self.moderator = User.objects.create_user("mod", password="x", is_staff=True)

    def test_check_response_lists_the_checks_that_ran(self):
        data = self.client.post("/api/check/message/", {"message": "Reply with your PIN now"}, format="json").data
        ids = [check["id"] for check in data["checks"]]
        self.assertEqual(ids[0], "rules")
        self.assertTrue(data["checks"][0]["finding"])
        self.assertIn("ai", ids)
        # Online checks are switched off in tests, so they must say so instead of pretending to pass.
        self.assertEqual(next(c for c in data["checks"] if c["id"] == "ai")["status"], CheckStatus.NOT_CONFIGURED)

    def test_alerts_feed_shows_only_approved_reports_with_details_hidden(self):
        approved = submit_report(self.user, ReportType.MESSAGE, "Send your PIN to 0788123456 now")
        approve_report(approved, self.moderator)
        submit_report(self.user, ReportType.URL, "http://still-pending.example")

        alerts = self.client.get("/api/reports/alerts/").data
        self.assertEqual(len(alerts), 1)
        self.assertNotIn("0788123456", alerts[0]["content"])
        self.assertNotIn("submitted_by", alerts[0])

    def test_stats_are_real_counts(self):
        approve_report(submit_report(self.user, ReportType.PHONE, "+250788000999"), self.moderator)
        submit_report(self.user, ReportType.URL, "http://pending.example")
        stats = self.client.get("/api/reports/stats/").data
        self.assertEqual(stats["approved_reports"], 1)
        self.assertEqual(stats["approved_by_type"]["PHONE"], 1)
        self.assertEqual(stats["pending_reports"], 1)
        self.assertEqual(stats["suspicious_numbers"], 1)
