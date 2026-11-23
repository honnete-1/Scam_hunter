from concurrent.futures import ThreadPoolExecutor

from .ai_analyzer import AIAnalyzer, CheckStatus
from .analysis_result import AnalysisResult
from .reference_repository import LookupStatus, ReferenceRepository
from .requests import MessageCheck, PhoneCheck, URLCheck, extract_domain
from .rule_engine import RuleEngine, make_indicator
from .threat_intel import extract_links, run_link_checks
from .translator import Translator


def check_entry(check_id, label, status, detail="", finding=False):
    return {"id": check_id, "label": label, "status": status, "finding": finding, "detail": detail}


def lookup_entry(check_id, label, lookup, detail=""):
    status = CheckStatus.UNAVAILABLE if lookup.status == LookupStatus.UNAVAILABLE else CheckStatus.COMPLETED
    return check_entry(check_id, label, status, detail, finding=lookup.status == LookupStatus.MATCH)


def merge_online_checks(results_per_link):
    # One row per service, even when a message contains several links.
    merged = {}
    for link_checks in results_per_link:
        for check in link_checks:
            row = merged.setdefault(check.id, check_entry(check.id, check.label, check.status))
            if check.status == CheckStatus.UNAVAILABLE:
                row["status"] = CheckStatus.UNAVAILABLE
            elif check.status == CheckStatus.COMPLETED and row["status"] == CheckStatus.NOT_CONFIGURED:
                row["status"] = CheckStatus.COMPLETED
            if check.finding:
                row["finding"] = True
                row["detail"] = check.detail
            elif check.detail and not row["detail"]:
                row["detail"] = check.detail
    return list(merged.values())


def online_indicators(url, link_checks):
    # Turns online findings into warning signs. Each kind is its own category, like the rules.
    domain = extract_domain(url)
    indicators = []
    for check in link_checks:
        if check.finding and check.id in ("safe_browsing", "urlhaus"):
            indicators.append(make_indicator(
                "known_malicious_link", f"{domain}: {check.detail}",
                "An online safety service lists this website as harmful.",
            ))
        elif check.finding and check.id == "domain_age":
            indicators.append(make_indicator(
                "new_domain", f"{domain}: {check.detail.lower()}",
                "Scam websites are often created only days before they are used.",
            ))
    return indicators


# Coordinates a check: validate -> rules -> reference lookup -> optional online checks -> result.
class AnalysisService:
    def __init__(self, rule_engine=None, repository=None, ai_analyzer=None, link_checker=None, translator=None):
        self.rule_engine = rule_engine or RuleEngine()
        self.repository = repository or ReferenceRepository()
        self.ai_analyzer = ai_analyzer or AIAnalyzer()
        self.link_checker = link_checker or run_link_checks
        self.translator = translator or Translator()

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
        result.generate_headline()
        if result.language and result.language != "en":
            self._translate(result)
        return result

    def _translate(self, result):
        # Answer in the scam message's language. If translation fails, the English text stays.
        texts = {"headline": result.headline, "explanation": result.explanation, "safer_action": result.safer_action}
        for number, indicator in enumerate(result.warning_indicators):
            texts[f"indicator_{number}"] = indicator["explanation"]
        translated = self.translator.translate(texts, result.language)
        if translated is None:
            return

        result.english = {"headline": result.headline, "explanation": result.explanation, "safer_action": result.safer_action}
        result.headline = translated["headline"]
        result.explanation = translated["explanation"]
        result.safer_action = translated["safer_action"]
        result.warning_indicators = [
            {**indicator, "explanation": translated[f"indicator_{number}"]}
            for number, indicator in enumerate(result.warning_indicators)
        ]

    def _analyze_message(self, check_request):
        message = check_request.normalized
        indicators = self.rule_engine.detect_scam_like_signs(message)
        checks = [check_entry("rules", "Scam-pattern rules", CheckStatus.COMPLETED, finding=bool(indicators))]
        links = extract_links(message)
        reference_match, lookup_completed = None, True

        # The slow online checks run at the same time; database lookups stay on this thread.
        with ThreadPoolExecutor(max_workers=4) as pool:
            ai_future = pool.submit(self.ai_analyzer.analyze, message)
            link_futures = [pool.submit(self.link_checker, url, extract_domain(url)) for url in links]

            for url in links:
                indicators += self.rule_engine.inspect_url_structure(url)
                # Links inside a message are checked against approved records like a URL check,
                # and a failed lookup makes the whole check unavailable, as for URLs.
                lookup = self.repository.find_url_match(url)
                if lookup.status == LookupStatus.UNAVAILABLE:
                    lookup_completed = False
                elif lookup.match is not None and reference_match is None:
                    reference_match = lookup.match
            if links:
                checks.append(check_entry(
                    "reference", "Approved suspicious links",
                    CheckStatus.COMPLETED if lookup_completed else CheckStatus.UNAVAILABLE,
                    finding=reference_match is not None,
                ))

            similar = self.repository.find_similar_reports(message)
            ai = ai_future.result()
            link_results = [future.result() for future in link_futures]

        if similar.status == LookupStatus.MATCH:
            indicators.append(make_indicator(
                "similar_to_reported", f"Similar to {similar.match} confirmed community report(s)",
                "The message closely matches scam messages that moderators have approved.",
            ))
        checks.append(lookup_entry(
            "community", "Community reports", similar,
            f"Similar to {similar.match} confirmed report(s)" if similar.status == LookupStatus.MATCH else "",
        ))

        # The AI can only add a warning sign; it never removes what the rules found.
        if ai.flags_message:
            indicators.append(make_indicator(
                "ai_assessment", ai.reason or f"AI confidence {ai.confidence:.0%}",
                "An AI model reviewing the message also rated it as scam-like.",
            ))
        ai_detail = f"{ai.reason} ({ai.confidence:.0%} confidence)" if ai.status == CheckStatus.COMPLETED else ""
        checks.append(check_entry("ai", "AI analysis", ai.status, ai_detail, finding=ai.flags_message))

        for url, link_checks in zip(links, link_results):
            indicators += online_indicators(url, link_checks)
        checks += merge_online_checks(link_results)

        return AnalysisResult(
            check_request.check_type,
            warning_indicators=indicators,
            reference_match=reference_match,
            lookup_completed=lookup_completed,
            checks=checks,
            ai_score=ai.scam_score,
            language=ai.language or None,
        )

    def _analyze_url(self, check_request):
        url = check_request.normalized
        indicators = self.rule_engine.inspect_url_structure(url)
        structure_found = bool(indicators)
        with ThreadPoolExecutor(max_workers=1) as pool:
            link_future = pool.submit(self.link_checker, url, check_request.domain)
            lookup = self.repository.find_url_match(url)
            link_checks = link_future.result()

        indicators += online_indicators(url, link_checks)
        checks = [
            check_entry("rules", "Link structure rules", CheckStatus.COMPLETED, finding=structure_found),
            lookup_entry("reference", "Approved suspicious links", lookup),
            *merge_online_checks([link_checks]),
        ]
        return self._build_result(check_request, indicators, lookup, checks)

    def _analyze_phone(self, check_request):
        lookup = self.repository.find_phone_match(check_request.normalized)
        reputation = self.repository.phone_reputation(check_request.normalized)
        checks = [
            lookup_entry("reference", "Approved suspicious numbers", lookup),
            lookup_entry("community", "Community reports", reputation),
        ]
        details = reputation.match if reputation.status != LookupStatus.UNAVAILABLE else None
        return self._build_result(check_request, [], lookup, checks, reputation=details)

    def _build_result(self, check_request, indicators, lookup, checks, reputation=None):
        # A failed lookup should not look like a safe result.
        return AnalysisResult(
            check_request.check_type,
            warning_indicators=indicators,
            reference_match=lookup.match if lookup.status != LookupStatus.UNAVAILABLE else None,
            lookup_completed=lookup.status != LookupStatus.UNAVAILABLE,
            checks=checks,
            reputation=reputation,
        )
