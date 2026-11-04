from unittest.mock import patch

from django.db import DatabaseError
from django.test import SimpleTestCase, TestCase

from checking.analysis_result import AnalysisResult, ConcernLevel, ResultStatus
from checking.models import PhoneReferenceRecord, URLReferenceRecord
from checking.reference_repository import LookupResult, LookupStatus
from checking.requests import CheckValidationError, MessageCheck, PhoneCheck, URLCheck
from checking.services import AnalysisService


def fake_indicators(*types):
    return [{"type": t, "evidence": "x", "explanation": "y"} for t in types]


def build(check_type="MESSAGE", indicators=(), reference_match=None, lookup_completed=True):
    result = AnalysisResult(check_type, list(indicators), reference_match, lookup_completed)
    result.determine_concern_level()
    result.generate_explanation()
    result.generate_safer_action()
    return result


class ConcernClassificationTests(SimpleTestCase):
    def test_zero_indicators_is_no_known_warning_signs(self):
        self.assertEqual(build().concern_level, ConcernLevel.NO_KNOWN_WARNING_SIGNS)

    def test_one_indicator_is_caution(self):
        self.assertEqual(build(indicators=fake_indicators("urgency")).concern_level, ConcernLevel.CAUTION)

    def test_two_indicators_is_caution(self):
        result = build(indicators=fake_indicators("urgency", "payment_request"))
        self.assertEqual(result.concern_level, ConcernLevel.CAUTION)

    def test_three_indicators_is_high_concern(self):
        result = build(indicators=fake_indicators("urgency", "payment_request", "reward_claim"))
        self.assertEqual(result.concern_level, ConcernLevel.HIGH_CONCERN)

    def test_duplicate_indicator_types_counted_once(self):
        result = build(indicators=fake_indicators("urgency", "urgency", "urgency"))
        self.assertEqual(result.concern_level, ConcernLevel.CAUTION)

    def test_reference_match_is_high_concern_even_with_no_indicators(self):
        result = build(check_type="PHONE", reference_match=object())
        self.assertEqual(result.concern_level, ConcernLevel.HIGH_CONCERN)
        self.assertIn("approved suspicious reference record", result.explanation)

    def test_lookup_failure_never_no_known_warning_signs(self):
        result = build(check_type="URL", lookup_completed=False)
        self.assertEqual(result.status, ResultStatus.CHECK_UNAVAILABLE)
        self.assertIsNone(result.concern_level)
        self.assertNotEqual(result.concern_level, ConcernLevel.NO_KNOWN_WARNING_SIGNS)
        self.assertIn("could not be completed", result.explanation)
        self.assertIn("Do not rely on this check", result.safer_action)

    def test_every_normal_result_has_explanation_and_safer_action(self):
        for indicators in [(), fake_indicators("urgency"), fake_indicators("urgency", "impersonation", "payment_request")]:
            result = build(indicators=indicators)
            self.assertTrue(result.explanation)
            self.assertTrue(result.safer_action)

    def test_wording_never_claims_certainty(self):
        for result in [build(), build(indicators=fake_indicators("urgency", "payment_request", "reward_claim")),
                       build(check_type="URL", reference_match=object())]:
            text = (result.explanation + " " + result.safer_action).lower()
            self.assertNotIn("definitely", text)
            self.assertNotIn("is a scam", text)
            self.assertNotIn("guaranteed safe", text)

    def test_explanation_mentions_the_evidence(self):
        result = build(indicators=fake_indicators("urgency", "payment_request"))
        self.assertEqual(result.explanation, "This message uses urgent language and asks for money or a payment.")

    def test_safer_action_relates_to_evidence(self):
        result = build(indicators=fake_indicators("sensitive_information_request"))
        self.assertIn("one-time codes", result.safer_action)


class AnalysisServiceMessageTests(SimpleTestCase):
    def setUp(self):
        self.service = AnalysisService()

    def test_invalid_input_raises_instead_of_returning_a_result(self):
        with self.assertRaises(CheckValidationError):
            self.service.analyze(MessageCheck("   "))

    def test_normal_message(self):
        result = self.service.analyze(MessageCheck("See you at the library at 3pm."))
        self.assertEqual(result.status, ResultStatus.SUCCESS)
        self.assertEqual(result.concern_level, ConcernLevel.NO_KNOWN_WARNING_SIGNS)

    def test_scam_like_message_is_high_concern(self):
        message = "Congratulations, you have won a prize! Pay the processing fee immediately to claim it."
        result = self.service.analyze(MessageCheck(message))
        self.assertEqual(result.concern_level, ConcernLevel.HIGH_CONCERN)
        self.assertEqual(len(result.distinct_indicator_types()), 3)


class UnavailableRepository:
    # A stand-in repository that always fails, to test the failure path.
    def find_url_match(self, url):
        return LookupResult(LookupStatus.UNAVAILABLE, error="offline")

    def find_phone_match(self, phone_number):
        return LookupResult(LookupStatus.UNAVAILABLE, error="offline")


class AnalysisServiceReferenceTests(TestCase):
    def setUp(self):
        self.service = AnalysisService()

    def test_url_with_approved_match_is_high_concern(self):
        URLReferenceRecord.objects.create(url="https://totally-normal.example/pay")
        result = self.service.analyze(URLCheck("totally-normal.example/pay"))
        self.assertEqual(result.concern_level, ConcernLevel.HIGH_CONCERN)

    def test_phone_with_approved_match_is_high_concern(self):
        PhoneReferenceRecord.objects.create(phone_number="+250788000111")
        result = self.service.analyze(PhoneCheck("+250 788 000 111"))
        self.assertEqual(result.concern_level, ConcernLevel.HIGH_CONCERN)

    def test_url_no_match_no_indicators(self):
        result = self.service.analyze(URLCheck("https://www.example.com/news"))
        self.assertEqual(result.status, ResultStatus.SUCCESS)
        self.assertEqual(result.concern_level, ConcernLevel.NO_KNOWN_WARNING_SIGNS)

    def test_phone_no_match(self):
        result = self.service.analyze(PhoneCheck("+250788123456"))
        self.assertEqual(result.concern_level, ConcernLevel.NO_KNOWN_WARNING_SIGNS)

    def test_url_lookup_failure_is_check_unavailable(self):
        service = AnalysisService(repository=UnavailableRepository())
        # A clean URL: without the failure rule this would be NO_KNOWN_WARNING_SIGNS.
        result = service.analyze(URLCheck("https://www.example.com"))
        self.assertEqual(result.status, ResultStatus.CHECK_UNAVAILABLE)
        self.assertIsNone(result.concern_level)

    def test_phone_lookup_failure_is_check_unavailable(self):
        service = AnalysisService(repository=UnavailableRepository())
        result = service.analyze(PhoneCheck("+250788123456"))
        self.assertEqual(result.status, ResultStatus.CHECK_UNAVAILABLE)
        self.assertNotEqual(result.concern_level, ConcernLevel.NO_KNOWN_WARNING_SIGNS)

    def test_real_database_error_is_check_unavailable(self):
        with patch("checking.reference_repository.approved_only", side_effect=DatabaseError("disk I/O error")):
            result = self.service.analyze(PhoneCheck("+250788123456"))
        self.assertEqual(result.status, ResultStatus.CHECK_UNAVAILABLE)
        self.assertIsNone(result.concern_level)
