# Rule-based detection of warning indicators (no machine learning).
# Finding a sign does not prove a scam, so result wording stays cautious.

import ipaddress
import re
from urllib.parse import urlsplit

# Each message category has a list of regex patterns and one explanation.
# To change what is detected, edit these lists.
MESSAGE_RULES = {
    "urgency": {
        "patterns": [
            r"\burgent(ly)?\b",
            r"\bimmediately\b",
            r"\bact now\b",
            r"\bright away\b",
            r"\bas soon as possible\b",
            r"\basap\b",
            r"\bwithin \d+ (minutes?|hours?|days?)\b",
            r"\b(expires?|ends?) (today|tonight|soon)\b",
            r"\blast chance\b",
            r"\bfinal (notice|warning|reminder)\b",
            r"\bbefore it'?s too late\b",
        ],
        "explanation": "The message pressures you to act immediately.",
    },
    "sensitive_information_request": {
        "patterns": [
            r"\bpassword\b",
            r"\bpin\b",
            r"\botp\b",
            r"\bone[- ]time (password|code|pin)\b",
            r"\b(verification|security|confirmation) code\b",
            r"\bcvv\b",
            r"\bcard (number|details)\b",
            r"\b(bank|account|login) details\b",
            r"\baccount number\b",
            r"\b(national id|id number|passport number)\b",
        ],
        "explanation": "The message asks for private information such as a password, PIN or code.",
    },
    "payment_request": {
        "patterns": [
            r"\bsend (me |us )?(the )?money\b",
            r"\b(transfer|send|pay|deposit) (\$|usd|rwf|frw)?\s?\d+",
            r"\bpay (now|a fee|the fee|today)\b",
            r"\b(processing|registration|release|delivery|clearance) fee\b",
            r"\bmobile money\b",
            r"\bmomo\b",
            r"\bgift cards?\b",
            r"\b(bitcoin|crypto(currency)?|usdt)\b",
            r"\bwestern union\b",
            r"\bwire (transfer|the money)\b",
        ],
        "explanation": "The message asks you to send money or make a payment.",
    },
    "impersonation": {
        "patterns": [
            r"\bdear (valued )?(customer|client|user|account holder)\b",
            r"\b(customer care|customer service|support team|security team|fraud department)\b",
            r"\b(this is|from|message from) (your|the) (bank|police|tax office|government)\b",
            r"\b(paypal|amazon|netflix|microsoft|apple|whatsapp|mtn|airtel)\b",
        ],
        "explanation": "The message appears to claim it comes from a known organisation or official team.",
    },
    "reward_claim": {
        "patterns": [
            r"\byou('ve| have)? won\b",
            r"\bwinner\b",
            r"\bcongratulations\b",
            r"\b(prize|lottery|jackpot)\b",
            r"\bclaim your (reward|prize|gift|money|bonus)\b",
            r"\bfree (gift|money|iphone|airtime)\b",
            r"\b(cash reward|cash prize)\b",
            r"\byou have been selected\b",
        ],
        "explanation": "The message claims you have won a prize or reward.",
    },
    "emotional_pressure": {
        "patterns": [
            r"\b(emergency|hospital|accident)\b",
            r"\bi('m| am) (stuck|stranded|in trouble)\b",
            r"\b(please )?help me\b",
            r"\b(don'?t|do not) tell anyone\b",
            r"\bkeep (this|it) (a )?(secret|between us)\b",
            r"\b(arrest(ed)?|arrest warrant|legal action|you will be prosecuted)\b",
            r"\byou will regret\b",
            r"\bthis is my new number\b",
        ],
        "explanation": "The message uses fear, threats or a personal emergency to pressure you.",
    },
}

URL_SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "cutt.ly", "rb.gy", "shorturl.at"}

# Words that scam pages often put in the domain name to look official.
SUSPICIOUS_DOMAIN_WORDS = ["login", "verify", "secure", "account", "update", "confirm", "wallet", "banking"]

MAX_NORMAL_URL_LENGTH = 100
MAX_NORMAL_SUBDOMAINS = 3


def make_indicator(indicator_type, evidence, explanation):
    return {"type": indicator_type, "evidence": evidence, "explanation": explanation}


class RuleEngine:
    def detect_scam_like_signs(self, message):
        # Returns at most one indicator per category, so several urgent
        # phrases still only count once when the concern level is decided.
        indicators = []
        for indicator_type, rule in MESSAGE_RULES.items():
            for pattern in rule["patterns"]:
                match = re.search(pattern, message, re.IGNORECASE)
                if match:
                    indicators.append(
                        make_indicator(indicator_type, match.group(0), rule["explanation"])
                    )
                    break
        return indicators

    def inspect_url_structure(self, url):
        # Expects a URL that has already been normalized by URLCheck.
        indicators = []
        parts = urlsplit(url)
        host = parts.hostname or ""
        domain = host[4:] if host.startswith("www.") else host

        if self._is_ip_address(host):
            indicators.append(make_indicator(
                "ip_address_host",
                host,
                "The link uses a raw IP address instead of a normal website name.",
            ))

        # In "http://bank.com@evil.com" the real destination is evil.com.
        if "@" in parts.netloc:
            indicators.append(make_indicator(
                "credentials_in_url",
                parts.netloc,
                "The link contains an '@' symbol, which can hide the real website it opens.",
            ))

        if "xn--" in host:
            indicators.append(make_indicator(
                "punycode_domain",
                host,
                "The website name uses special characters that can imitate a well-known name.",
            ))

        if domain in URL_SHORTENERS:
            indicators.append(make_indicator(
                "url_shortener",
                domain,
                "The link is shortened, so the real destination is hidden.",
            ))

        # "a.b.c.d.example.com" has 4 subdomain levels before example.com.
        if not self._is_ip_address(host) and domain.count(".") - 1 > MAX_NORMAL_SUBDOMAINS:
            indicators.append(make_indicator(
                "excessive_subdomains",
                host,
                "The website name has an unusually large number of parts.",
            ))

        for word in SUSPICIOUS_DOMAIN_WORDS:
            if word in domain:
                indicators.append(make_indicator(
                    "suspicious_domain_word",
                    word,
                    "The website name contains a word often used to make fake pages look official.",
                ))
                break

        if len(url) > MAX_NORMAL_URL_LENGTH:
            indicators.append(make_indicator(
                "very_long_url",
                f"{len(url)} characters",
                "The link is unusually long, which can be used to hide where it really goes.",
            ))

        return indicators

    def _is_ip_address(self, host):
        try:
            ipaddress.ip_address(host.strip("[]"))
            return True
        except ValueError:
            return False
