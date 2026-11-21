# Runs the real AnalysisService over an evaluation set and counts what was flagged.
import time

from checking.ai_analyzer import AIAssessment, CheckStatus
from checking.analysis_result import ConcernLevel
from checking.requests import MessageCheck
from checking.services import AnalysisService

from . import dataset

FLAGGED_LEVELS = (ConcernLevel.CAUTION, ConcernLevel.HIGH_CONCERN)

EVALUATION_SETS = {
    "main": (dataset.SUSPICIOUS_MESSAGES, dataset.LEGITIMATE_MESSAGES),
    "holdout": (dataset.HOLDOUT_SUSPICIOUS_MESSAGES, dataset.HOLDOUT_LEGITIMATE_MESSAGES),
    "challenge": (dataset.CHALLENGE_SUSPICIOUS_MESSAGES, dataset.CHALLENGE_LEGITIMATE_MESSAGES),
}


# Groq's free tier allows about 30 requests a minute, so online runs wait between messages.
ONLINE_DELAY_SECONDS = 2.1


class RulesOnlyAI:
    def analyze(self, message):
        return AIAssessment(CheckStatus.NOT_CONFIGURED)


def build_service(online):
    # By default only the rules and our own database are used, so results can be repeated exactly.
    if online:
        return AnalysisService()
    return AnalysisService(ai_analyzer=RulesOnlyAI(), link_checker=lambda url, domain: [])


def analyze_messages(messages, online=False):
    service = build_service(online)
    rows = []
    for message in messages:
        if online and rows:
            time.sleep(ONLINE_DELAY_SECONDS)
        result = service.analyze(MessageCheck(message))
        rows.append({
            "message": message,
            "concern_level": result.concern_level,
            "categories": result.distinct_indicator_types(),
            "flagged": result.concern_level in FLAGGED_LEVELS,
        })
    return rows


def evaluate_detector(set_name="main", online=False):
    suspicious_messages, legitimate_messages = EVALUATION_SETS[set_name]
    suspicious = analyze_messages(suspicious_messages, online)
    legitimate = analyze_messages(legitimate_messages, online)

    detected = [row for row in suspicious if row["flagged"]]
    false_positives = [row for row in legitimate if row["flagged"]]

    return {
        "suspicious_total": len(suspicious),
        "suspicious_detected": len(detected),
        "detection_rate": len(detected) / len(suspicious),
        "missed": [row for row in suspicious if not row["flagged"]],
        "legitimate_total": len(legitimate),
        "false_positive_count": len(false_positives),
        "false_positive_rate": len(false_positives) / len(legitimate),
        "false_positives": false_positives,
        "suspicious_rows": suspicious,
    }
