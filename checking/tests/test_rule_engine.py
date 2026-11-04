from django.test import SimpleTestCase

from checking.requests import normalize_url
from checking.rule_engine import RuleEngine


def indicator_types(indicators):
    return [indicator["type"] for indicator in indicators]


class MessageRuleTests(SimpleTestCase):
    def setUp(self):
        self.engine = RuleEngine()

    def assert_detects(self, message, expected_type):
        indicators = self.engine.detect_scam_like_signs(message)
        self.assertIn(expected_type, indicator_types(indicators))

    def test_urgency_detected(self):
        self.assert_detects("Act now before your account is blocked", "urgency")

    def test_sensitive_information_request_detected(self):
        self.assert_detects("Reply with the OTP we sent you", "sensitive_information_request")

    def test_payment_request_detected(self):
        self.assert_detects("Send 5000 RWF by mobile money to release your parcel", "payment_request")

    def test_impersonation_detected(self):
        self.assert_detects("Dear customer, this is your bank", "impersonation")

    def test_reward_claim_detected(self):
        self.assert_detects("Congratulations! You have won a new phone", "reward_claim")

    def test_emotional_pressure_detected(self):
        self.assert_detects("Mum I am in trouble, please help me and don't tell anyone", "emotional_pressure")

    def test_indicator_has_evidence_and_explanation(self):
        indicators = self.engine.detect_scam_like_signs("Please respond URGENTLY")
        self.assertEqual(len(indicators), 1)
        self.assertEqual(indicators[0]["type"], "urgency")
        self.assertEqual(indicators[0]["evidence"], "URGENTLY")
        self.assertTrue(indicators[0]["explanation"])

    def test_repeated_category_counts_once(self):
        message = "Urgent! Act now, respond immediately, last chance!"
        self.assertEqual(indicator_types(self.engine.detect_scam_like_signs(message)), ["urgency"])

    def test_normal_message_has_no_indicators(self):
        message = "Hi, are we still meeting for lunch tomorrow at noon?"
        self.assertEqual(self.engine.detect_scam_like_signs(message), [])

    def test_whole_words_only(self):
        # "spinach" contains "pin" but should not count as a PIN request.
        self.assertEqual(self.engine.detect_scam_like_signs("I bought spinach and apples"), [])


class URLStructureTests(SimpleTestCase):
    def setUp(self):
        self.engine = RuleEngine()

    def inspect(self, url):
        return indicator_types(self.engine.inspect_url_structure(normalize_url(url)))

    def test_ip_address_host(self):
        self.assertIn("ip_address_host", self.inspect("http://192.168.0.1/login"))

    def test_at_symbol(self):
        self.assertIn("credentials_in_url", self.inspect("http://mybank.com@evil.example/"))

    def test_punycode(self):
        self.assertIn("punycode_domain", self.inspect("http://xn--pple-43d.com"))

    def test_shortener(self):
        self.assertIn("url_shortener", self.inspect("https://bit.ly/abc123"))

    def test_excessive_subdomains(self):
        self.assertIn("excessive_subdomains", self.inspect("http://a.b.c.d.example.com"))

    def test_suspicious_domain_word(self):
        self.assertIn("suspicious_domain_word", self.inspect("http://secure-login-bank.com"))

    def test_long_url(self):
        self.assertIn("very_long_url", self.inspect("http://example.com/" + "a" * 120))

    def test_ordinary_url_has_no_indicators(self):
        self.assertEqual(self.inspect("https://www.example.com/news/today"), [])
