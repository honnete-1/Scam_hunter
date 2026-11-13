# Runs the real AnalysisService over an evaluation set and counts what was flagged.
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


def analyze_messages(messages):
    service = AnalysisService()
    rows = []
    for message in messages:
        result = service.analyze(MessageCheck(message))
        rows.append({
            "message": message,
            "concern_level": result.concern_level,
            "categories": result.distinct_indicator_types(),
            "flagged": result.concern_level in FLAGGED_LEVELS,
        })
    return rows


def evaluate_detector(set_name="main"):
    suspicious_messages, legitimate_messages = EVALUATION_SETS[set_name]
    suspicious = analyze_messages(suspicious_messages)
    legitimate = analyze_messages(legitimate_messages)

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
