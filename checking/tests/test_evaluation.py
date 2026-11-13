from django.test import SimpleTestCase

from checking.analysis_result import ConcernLevel
from checking.evaluation.evaluate import evaluate_detector
from checking.requests import MessageCheck
from checking.services import AnalysisService


class CombinationClassificationTests(SimpleTestCase):
    # These go through the real AnalysisService, so they also check the unchanged thresholds.
    def analyze(self, message):
        return AnalysisService().analyze(MessageCheck(message))

    def test_fake_mtn_support_is_high_concern(self):
        result = self.analyze(
            "This is MTN Customer Care.\nYour account will be suspended within 30 minutes.\n"
            "Reply with your OTP and send 5,000 RWF through MoMo to restore access."
        )
        self.assertEqual(result.concern_level, ConcernLevel.HIGH_CONCERN)
        self.assertEqual(
            set(result.distinct_indicator_types()),
            {"impersonation", "urgency", "sensitive_information_request", "payment_request"},
        )

    def test_fake_prize_is_high_concern(self):
        result = self.analyze(
            "Congratulations! You have been selected to receive 500,000 RWF.\n"
            "Pay a 10,000 RWF processing fee now to claim your reward."
        )
        self.assertEqual(result.concern_level, ConcernLevel.HIGH_CONCERN)
        self.assertEqual(set(result.distinct_indicator_types()), {"reward_claim", "payment_request", "urgency"})

    def test_repeated_urgency_stays_caution(self):
        # Many urgent phrases are still one category, so they can't push a message to High Concern alone.
        result = self.analyze("URGENT!\nAct now!\nRespond immediately!\nThis is your last chance!")
        self.assertEqual(result.distinct_indicator_types(), ["urgency"])
        self.assertEqual(result.concern_level, ConcernLevel.CAUTION)

    def test_safety_advice_gets_no_known_warning_signs(self):
        result = self.analyze("Never share your password or OTP with anyone. Banks will never ask for your PIN.")
        self.assertEqual(result.concern_level, ConcernLevel.NO_KNOWN_WARNING_SIGNS)


class EvaluationTargetTests(SimpleTestCase):
    # MVP targets: at least 80% of suspicious messages flagged, at most 20% of legitimate ones.
    # The challenge set is reported by "evaluate_detector" but not asserted here, so it can't be tuned to pass.
    def test_targets_on_each_evaluation_set(self):
        for set_name in ["main", "holdout"]:
            report = evaluate_detector(set_name)
            with self.subTest(set_name=set_name):
                self.assertGreaterEqual(report["detection_rate"], 0.80)
                self.assertLessEqual(report["false_positive_rate"], 0.20)

    def test_dataset_size(self):
        report = evaluate_detector("main")
        self.assertEqual(report["suspicious_total"], 30)
        self.assertEqual(report["legitimate_total"], 30)
