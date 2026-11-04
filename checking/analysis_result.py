# Rules: lookup failure -> CHECK_UNAVAILABLE, reference match or 3+ indicators -> HIGH_CONCERN,
# 1-2 indicators -> CAUTION, 0 indicators with completed lookups -> NO_KNOWN_WARNING_SIGNS.


class ConcernLevel:
    HIGH_CONCERN = "HIGH_CONCERN"
    CAUTION = "CAUTION"
    NO_KNOWN_WARNING_SIGNS = "NO_KNOWN_WARNING_SIGNS"


class ResultStatus:
    SUCCESS = "SUCCESS"
    CHECK_UNAVAILABLE = "CHECK_UNAVAILABLE"


HIGH_CONCERN_INDICATOR_COUNT = 3

SUBJECT_NAMES = {"MESSAGE": "message", "URL": "link", "PHONE": "phone number"}

# Short phrases used to build the explanation sentence, e.g.
# "This message uses urgent language and asks for money or a payment."
INDICATOR_PHRASES = {
    "urgency": "uses urgent language",
    "sensitive_information_request": "asks for private information such as a password, PIN or code",
    "payment_request": "asks for money or a payment",
    "impersonation": "appears to claim it comes from a known organisation",
    "reward_claim": "claims you have won a prize or reward",
    "emotional_pressure": "uses fear, threats or a personal emergency to pressure you",
    "ip_address_host": "uses a raw IP address instead of a website name",
    "credentials_in_url": "contains an '@' symbol that can hide the real destination",
    "punycode_domain": "uses special characters that can imitate a well-known website name",
    "url_shortener": "is shortened, so the real destination is hidden",
    "excessive_subdomains": "has an unusually large number of parts in its website name",
    "suspicious_domain_word": "has a word in its website name often used by fake login pages",
    "very_long_url": "is unusually long",
}

# Safer actions linked to specific evidence. Listed in priority order so the
# most important advice comes first.
INDICATOR_ACTIONS = [
    ("sensitive_information_request", "Never share passwords, PINs or one-time codes (OTPs), even if the request looks official."),
    ("payment_request", "Do not send money until you have verified the request independently."),
    ("impersonation", "Contact the organisation using its official website or phone number, not the details in the message."),
    ("credentials_in_url", "Do not open this link. Type the website address yourself instead."),
    ("ip_address_host", "Do not open this link or enter any details on the page it leads to."),
    ("punycode_domain", "Check the website name letter by letter, or type the official address yourself."),
    ("url_shortener", "Avoid opening shortened links from unexpected messages."),
    ("emotional_pressure", "Take your time. Call the person or organisation back on a number you already know."),
    ("reward_claim", "Be careful with unexpected prizes. Real prizes do not ask you to pay a fee first."),
    ("urgency", "Do not rush. Verify the sender through an official contact before responding."),
]

DEFAULT_CAUTION_ACTION = "Avoid opening the link or entering any details until you have verified where it really goes."


class AnalysisResult:
    def __init__(self, check_type, warning_indicators=None, reference_match=None, lookup_completed=True):
        self.check_type = check_type
        self.warning_indicators = warning_indicators or []
        self.reference_match = reference_match
        self.lookup_completed = lookup_completed

        self.status = ResultStatus.SUCCESS
        self.concern_level = None
        self.explanation = ""
        self.safer_action = ""

    def distinct_indicator_types(self):
        # Count categories, not keywords: two urgent phrases are still one urgency indicator.
        types = []
        for indicator in self.warning_indicators:
            if indicator["type"] not in types:
                types.append(indicator["type"])
        return types

    def determine_concern_level(self):
        # A failed lookup must never look like a safe result, so we stop here
        # before the normal classification can return NO_KNOWN_WARNING_SIGNS.
        if not self.lookup_completed:
            self.status = ResultStatus.CHECK_UNAVAILABLE
            self.concern_level = None
            return self.concern_level

        count = len(self.distinct_indicator_types())

        if self.reference_match is not None:
            self.concern_level = ConcernLevel.HIGH_CONCERN
        elif count >= HIGH_CONCERN_INDICATOR_COUNT:
            self.concern_level = ConcernLevel.HIGH_CONCERN
        elif count >= 1:
            self.concern_level = ConcernLevel.CAUTION
        else:
            self.concern_level = ConcernLevel.NO_KNOWN_WARNING_SIGNS
        return self.concern_level

    def generate_explanation(self):
        subject = SUBJECT_NAMES.get(self.check_type, "content")
        sentences = []

        if self.status == ResultStatus.CHECK_UNAVAILABLE:
            sentences.append("The reference lookup could not be completed, so no concern level was given.")
            if self.warning_indicators:
                sentences.append(f"Some warning signs were still noticed: this {subject} {self._join_phrases()}.")
            self.explanation = " ".join(sentences)
            return self.explanation

        if self.reference_match is not None:
            sentences.append(f"This {subject} matches an approved suspicious reference record.")

        if self.warning_indicators:
            sentences.append(f"This {subject} {self._join_phrases()}.")

        if not sentences:
            sentences.append(
                "No configured warning indicators or approved suspicious record matches were found. "
                "This does not guarantee that it is safe."
            )

        self.explanation = " ".join(sentences)
        return self.explanation

    def generate_safer_action(self):
        if self.status == ResultStatus.CHECK_UNAVAILABLE:
            self.safer_action = "Do not rely on this check yet. Verify the sender or destination independently."
            return self.safer_action

        if self.concern_level == ConcernLevel.NO_KNOWN_WARNING_SIGNS:
            self.safer_action = (
                "Continue to use caution and verify unexpected requests before sharing sensitive information."
            )
            return self.safer_action

        actions = []
        if self.reference_match is not None:
            if self.check_type == "PHONE":
                actions.append("Do not reply, call back or send money to this number.")
            else:
                actions.append("Do not open this link or enter any information on the page.")

        # Pick up to two actions that relate to the evidence that was found.
        found_types = self.distinct_indicator_types()
        for indicator_type, action in INDICATOR_ACTIONS:
            if indicator_type in found_types and len(actions) < 2:
                actions.append(action)

        if not actions:
            actions.append(DEFAULT_CAUTION_ACTION)

        self.safer_action = " ".join(actions)
        return self.safer_action

    def _join_phrases(self):
        phrases = [INDICATOR_PHRASES.get(t, t.replace("_", " ")) for t in self.distinct_indicator_types()]
        if len(phrases) == 1:
            return phrases[0]
        return ", ".join(phrases[:-1]) + " and " + phrases[-1]

    def to_dict(self):
        return {
            "status": self.status,
            "concern_level": self.concern_level,
            "indicators": self.warning_indicators,
            "reference_match": self.reference_match is not None,
            "explanation": self.explanation,
            "safer_action": self.safer_action,
        }
