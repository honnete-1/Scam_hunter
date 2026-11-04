from .analysis_result import AnalysisResult
from .reference_repository import LookupStatus, ReferenceRepository
from .requests import MessageCheck, PhoneCheck, URLCheck
from .rule_engine import RuleEngine


# Coordinates a check: validate -> rules -> reference lookup -> result.
class AnalysisService:
    def __init__(self, rule_engine=None, repository=None):
        self.rule_engine = rule_engine or RuleEngine()
        self.repository = repository or ReferenceRepository()

    def analyze(self, check_request):
        # Validation always happens first. Invalid input raises
        # CheckValidationError and never reaches the classification rules.
        check_request.validate()
        check_request.normalize()

        if isinstance(check_request, MessageCheck):
            result = self._analyze_message(check_request)
        elif isinstance(check_request, URLCheck):
            result = self._analyze_url(check_request)
        elif isinstance(check_request, PhoneCheck):
            result = self._analyze_phone(check_request)
        else:
            raise TypeError(f"Unsupported check request: {type(check_request).__name__}")

        result.determine_concern_level()
        result.generate_explanation()
        result.generate_safer_action()
        return result

    def _analyze_message(self, check_request):
        # Messages have no reference lookup yet, so there is nothing that can fail.
        indicators = self.rule_engine.detect_scam_like_signs(check_request.normalized)
        return AnalysisResult(check_request.check_type, warning_indicators=indicators)

    def _analyze_url(self, check_request):
        indicators = self.rule_engine.inspect_url_structure(check_request.normalized)
        lookup = self.repository.find_url_match(check_request.normalized)
        return self._build_result(check_request, indicators, lookup)

    def _analyze_phone(self, check_request):
        lookup = self.repository.find_phone_match(check_request.normalized)
        return self._build_result(check_request, [], lookup)

    def _build_result(self, check_request, indicators, lookup):
        # A failed lookup should not look like a safe result.
        if lookup.status == LookupStatus.UNAVAILABLE:
            return AnalysisResult(
                check_request.check_type,
                warning_indicators=indicators,
                lookup_completed=False,
            )

        return AnalysisResult(
            check_request.check_type,
            warning_indicators=indicators,
            reference_match=lookup.match,
            lookup_completed=True,
        )
