# Rule-based detection of warning indicators (no machine learning).
# Finding a sign does not prove a scam, so result wording stays cautious.

import ipaddress
import re
from urllib.parse import urlsplit

# Message rules look for behaviour (an action together with what it is about), not single words.
# e.g. "send" + "OTP" is a request, but "OTP" on its own could just be security advice.

# A short gap inside one sentence, so "send ... PIN" must be close together to match.
GAP = r"[^.!?\n;]{0,30}?"

# --- Vocabulary shared by the patterns below ---
URGENT_WORDS = r"(now|immediately|right away|urgently|quickly|asap|as soon as possible|without delay)"
TIME_UNITS = r"(minutes?|mins?|hours?|hrs?|days?)"
DELAY_ACTIONS = r"(act|respond|reply|verify|confirm|update|complete|pay|submit|send|call|click|log ?in|sign in)"
THREATENED_THINGS = r"(account|card|sim( card)?|line|number|service|wallet|access|membership|subscription|application|banking|profile)"
SHUTDOWN_WORDS = r"(blocked|suspended|closed|disabled|deactivated|terminated|locked|frozen|deleted|cancell?ed)"

SENSITIVE_DATA = (
    r"(password|passcode|pin( code| number)?|otp|one[- ]time (password|code|pin)"
    r"|(verification|security|confirmation|reset|login|access|activation|authentication) (code|number|pin)"
    r"|cvv|cvc|card (number|details)|account (number|details)|bank (account )?details"
    r"|login (details|credentials)|credentials|national id( number)?|id number|passport number"
    r"|(the )?codes?( (that )?(we|i) (just )?sent( you)?| you (just )?receive[d]?)"
    # Codes described by how they arrived: "SMS code", "six-digit number", "code from your SMS"
    r"|(sms|text( message)?) (code|pin|number)|(six|6|five|5|four|4)[- ]digit (code|number|pin)"
    r"|(code|number|pin) (from|in) (your |the )?(sms|text( message)?|message)"
    r"|number you (just )?receive[d]?)"
)
REQUEST_ACTIONS = r"(send|share|provide|enter|submit|give|type|tell (me|us)|forward|confirm|verify|reply with|text (me|us)|input|read( out)?)"

PAYMENT_ACTIONS = r"(send|pay|transfer|deposit|wire|top up|buy|purchase|load|invest|cover|settle)"
MONEY_OR_METHOD = (
    r"(money|cash|funds|(the )?(outstanding )?(amount|balance)|\d[\d,.]*\s?k?\s?(rwf|frw|usd|dollars?)|(rwf|frw|usd)\s?\d[\d,.]*"
    r"|\d+\s?k|momo|mobile money|airtime|(google play |itunes )?gift ?cards?|bitcoin|btc|crypto(currency)?|usdt"
    r"|western union|moneygram|wire transfer|(a |the )?\w* ?(fee|charges?))"
)
# An amount with no currency straight after the action: "transfer 20000", "settle 3500".
# Three or more digits, so "send 3 photos" does not count. "10k" is covered above.
BARE_AMOUNT = r"\d{1,3}(,\d{3})+|\d{3,}"
# These fees almost only appear in scams, so they count even without "pay".
SCAM_FEES = r"(processing|release|clearance|activation|unlock(ing)?|redelivery) fee"

ORGANISATIONS = (
    r"(mtn|airtel|momo|mobile money|paypal|amazon|netflix|microsoft|apple|google|whatsapp|facebook"
    r"|bank of kigali|bk|equity bank|rwanda revenue authority|rra|rib|irembo|dhl|fedex"
    r"|your bank|the bank|(the )?police|(the )?government|tax (office|authority)|customs)"
)
OFFICIAL_TEAMS = (
    r"(customer (care|service|support)|support team|security team|fraud (department|team)"
    r"|technical support|help desk|billing department)"
)
# Short team words like "support" or "security", used after a name: "MTN support", "Bank security".
TEAM_WORDS = r"(customer care|customer support|support( team)?|security( team)?|fraud (team|department)|help desk)"
# "MTN Customer Care", "customer care", "MTN support" or just "MTN".
ORGANISATION_OR_TEAM = (
    r"((" + ORGANISATIONS + r"\s+)?" + OFFICIAL_TEAMS + r"|" + ORGANISATIONS + r"(\s+" + TEAM_WORDS + r")?)"
)
# One or two words for a person's name, but not "my friend" or "the guy".
PERSON_NAME = r"(?!(my|our|his|her|their|a|an|the)\b)[a-z]+(\s+(?!from\b|with\b)[a-z]+)?"

WIN_WORDS = r"(won|been selected|been chosen|selected|chosen|qualified|entitled to)"
REWARD_WORDS = (
    r"(prize|reward|cash|money|bonus|gift|voucher|airtime|jackpot|lottery|giveaway"
    r"|smartphone|iphone|phone|laptop|car|\d[\d,.]*\s?(rwf|frw|usd|dollars?))"
)

# Each category has a list of patterns and one explanation. Only the first match per category counts.
# "skip_advice" ignores matches like "never share your PIN" or "I'll send the money" (see below).
# "skip_noun_use" ignores action words used as nouns, like "thanks for the transfer".
MESSAGE_RULES = {
    "urgency": {
        "patterns": [
            # Immediate action: "verify now", "reply immediately"
            r"\b" + DELAY_ACTIONS + r"\b" + GAP + r"\b" + URGENT_WORDS + r"\b",
            # Time limit tied to the reader: "you have 10 minutes", "verify within 24 hours"
            r"\byou (only )?have (only )?\d+\s*" + TIME_UNITS + r"\b",
            r"\b" + DELAY_ACTIONS + r"\b" + GAP + r"\b(within|in the next) \d+\s*" + TIME_UNITS + r"\b",
            r"\b(before midnight|before it'?s too late|before (this|the) (offer |link |code )?expires|today only|last chance)\b",
            r"\bfinal (notice|warning|reminder)\b",
            r"\b(expires?|ends?) (today|tonight|soon|in \d+\s*" + TIME_UNITS + r")\b",
            # Threatened consequence: "your account will be suspended"
            r"\b" + THREATENED_THINGS + r"\b" + GAP + r"\b(will|would|is going to|is about to)\s+(soon\s+)?be\s+" + SHUTDOWN_WORDS + r"\b",
            r"\byou will lose (access|your account|your money|your line)\b",
            # Already restricted + a fix to do: "Your SIM has been locked. Enter your PIN to unlock it."
            # A locked account on its own (e.g. in a demo) does not count. The (?=...) part checks for
            # the fix without adding it to the evidence.
            r"\b" + THREATENED_THINGS + r"\b" + GAP + r"\b(has been|have been|is|was)\s+(temporarily\s+)?(limited|restricted|locked|blocked|suspended|frozen|on hold|disabled)\b"
            + r"(?=[^\n]{0,60}?\b(restore|unlock|reactivate|verify|update|sign in|log ?in|click|confirm|enter|reply)\b)",
            # Avoiding a consequence: "to avoid suspension", "unless you verify"
            r"\bto (avoid|prevent) (the |your |any )?(account |line |card |service |sim )?(suspension|closure|deactivation|restrictions?|blocking|termination|return to sender)\b",
            r"\bunless you (verify|confirm|update|pay|respond|reply|sign in|log ?in|call)\b",
            # A clock-time deadline on an account or payment action: "deposit ... before 5pm"
            r"\b(verify|confirm|pay|send|deposit|transfer|reply|unlock|restore|update)\b" + GAP + r"\bbefore \d{1,2}(:\d{2})?\s?(am|pm)\b",
            r"\b(verify|confirm|pay|send|deposit|transfer|reply|unlock|restore|update)\b" + GAP + r"\bbefore \d{1,2}:\d{2}\b",
            # Conditional pressure: "if you don't verify ... blocked"
            r"\bif (you )?(do not|don'?t|fail to|not)\b" + GAP + r"\b(will be|blocked|suspended|closed|lose|deactivated)\b",
            r"\bfailure to (pay|settle|verify|respond|comply|update|confirm)\b",
            # A message that labels itself urgent: "URGENT: ...", "it's urgent"
            r"^\W*(urgent|important notice|final notice)\b",
            r"\b(it'?s|this is|it is) (very |really )?urgent\b",
        ],
        "explanation": "The message pressures you to act quickly.",
    },
    "sensitive_information_request": {
        "skip_advice": True,
        "patterns": [
            # Request + credential: "send me your OTP", "reply with your PIN"
            r"\b" + REQUEST_ACTIONS + r"\b" + GAP + r"\b" + SENSITIVE_DATA + r"\b",
            # "we need your password", "what is your PIN"
            r"\b(we need|i need|we require|kindly provide|what is|what's)\b" + GAP + r"\byour\s+" + SENSITIVE_DATA + r"\b",
            # Reversed: "your OTP must be sent to this number"
            r"\b" + SENSITIVE_DATA + r"\b" + GAP + r"\b(must|should|needs to) be (sent|shared|provided|entered|submitted|confirmed)\b",
        ],
        "explanation": "The message asks for sensitive account information such as a password, PIN or code.",
    },
    "payment_request": {
        "skip_advice": True,
        "skip_noun_use": True,
        "patterns": [
            # Payment action + money or payment method: "send 20,000 RWF", "pay via MoMo"
            r"\b" + PAYMENT_ACTIONS + r"\b" + GAP + r"\b" + MONEY_OR_METHOD + r"\b",
            r"\b" + PAYMENT_ACTIONS + r"\s+(me\s+|us\s+)?(" + BARE_AMOUNT + r")\b",
            # Money request phrased as a need: "we need 60,000 RWF", "I need you to pay"
            r"\b(i|we) need\b" + GAP + r"\b" + MONEY_OR_METHOD + r"\b",
            r"\b(i|we) need you to (pay|send|transfer|deposit|buy)\b",
            r"\b" + SCAM_FEES + r"\b",
            # Refund scam: "I sent you money by mistake, please send it back"
            r"\b(send|return|refund)\s+(it|the money|the funds)\s+back\b",
            # Passive form: "a fee of 1500 RWF is required"
            r"\b(payment|deposit|fee|charge)( of [^.!?\n;]{0,20})? (is|are) (required|needed)\b",
        ],
        "explanation": "The message asks you to send money or make a payment.",
    },
    "impersonation": {
        "patterns": [
            # Claim of identity: "this is MTN Customer Care", "message from the fraud department"
            r"\b(this is|we are|this message is from|message from|hello from|greetings from)\s+(the |your |an? )?(official )?" + ORGANISATION_OR_TEAM + r"\b",
            r"\b(calling|writing|contacting you|texting|messaging|reaching out)\s+(to you\s+)?(from|on behalf of)\s+(the |your )?" + ORGANISATION_OR_TEAM + r"\b",
            r"\bon behalf of\s+(the |your )?" + ORGANISATION_OR_TEAM + r"\b",
            r"\b(agent|officer|representative|official)\b" + GAP + r"\b(from|of|at)\s+(the |your )?" + ORGANISATION_OR_TEAM + r"\b",
            # "I am from MTN support", "I'm with Airtel customer care"
            r"\b(i am|i'm)\s+(calling |writing |texting )?(from|with)\s+(the |your )?" + ORGANISATION_OR_TEAM + r"\b",
            # A named person: "This is John from Bank of Kigali", "I'm Eric from MTN"
            r"\b(this is|it'?s|it is|i am|i'm|my name is)\s+" + PERSON_NAME + r"\s+(from|with)\s+(the |your )?" + ORGANISATION_OR_TEAM + r"\b",
            # Sign-off at the start of a sentence: "MTN support here", "Bank security here"
            r"(^|(?<=[.!?,] )|(?<=[.!?,]))((" + ORGANISATIONS + r"|bank)\s+)?" + TEAM_WORDS + r"\s+here\b",
            # Addressing you as their customer: "Dear MTN subscriber"
            r"\bdear (valued )?" + ORGANISATIONS + r"\s+(customer|subscriber|user|client|account holder)\b",
        ],
        "explanation": "The sender appears to claim they represent a trusted organisation.",
    },
    "reward_claim": {
        "patterns": [
            # Winning/selection + reward: "you have been selected to receive 500,000 RWF"
            # "You've" has no space before 've, so each helper word brings its own spacing.
            r"\b(you|your (number|phone number|sim|email|account))(\s+have|\s+has|'ve|\s+were|\s+was|\s+are)?\s+(just\s+)?" + WIN_WORDS + r"\b" + GAP + r"\b" + REWARD_WORDS + r"\b",
            # A phone number, SIM or email "winning" is a reward claim whatever the prize is,
            # because numbers do not win football matches.
            r"\byour (phone |mobile |sim )?(number|sim( card)?|line|email( address)?|account)\s+(has\s+|have\s+|was\s+)?(just\s+)?(won|been selected|been chosen)\b",
            r"\b(lucky winner|you are (the|a|our) (lucky )?winner|winning (number|ticket)|winner alert|promo(tion)? winner)\b",
            # A draw combined with winning: "won ... in our Mega Draw", "lucky draw winner"
            r"\b(won|winner|selected)\b" + GAP + r"\b(lucky|mega|grand|promo(tion)?) draw\b",
            r"\b(lucky|mega|grand|promo(tion)?) draw\b" + GAP + r"\b(won|winner|selected)\b",
            # Claiming the reward: "claim your prize", "collect your winnings"
            r"\b(claim|collect|redeem) (your|the)\b" + GAP + r"\b(prize|reward|winnings|gift|bonus|cash)\b",
        ],
        "explanation": "The message claims you won or were selected for a reward.",
    },
    "emotional_pressure": {
        "patterns": [
            # Sender in an emergency. Just being "at the hospital" is not enough on its own.
            r"\bi('m| am)\s+(stuck|stranded|in trouble|in danger|arrested|in jail|in police custody)\b",
            r"\bi('m| am) (in|at) (the )?hospital\b" + GAP + r"\b(need|send|pay|money|help)\b",
            r"\bi (had|have had|was in|got into) an? (accident|emergency)\b",
            # Someone close to you in an emergency: "your son was admitted after an accident"
            r"\byour (son|daughter|child|relative|mother|father|mum|mom|dad|husband|wife|brother|sister)\b" + GAP + r"\b(accident|hospital|admitted|arrested)\b",
            r"\b(this is|it'?s) an emergency\b",
            r"\bhelp me\b" + GAP + r"\b(money|send|pay|transfer|urgently|asap)\b",
            # Secrecy
            r"\b(don'?t|do not|never)\s+tell\s+(anyone|anybody|your (family|parents|wife|husband|friends)|mum|mom|dad)\b",
            r"\bkeep (this|it)\s+(a\s+)?(secret|between us|confidential|private)\b",
            r"\b(don'?t|do not)\s+(contact|call|inform|tell)\s+(the |your )?(bank|police|family|mtn|airtel)\b",
            # Threats
            r"\byou (will|could|may) be (arrested|prosecuted|jailed|reported|charged|fined)\b",
            r"\blegal action (will|may|shall) be taken\b",
            r"\b(result in|face|take) legal action\b",
            r"\blegal action being taken\b",
            r"\b(arrest warrant|warrant (of|for) (your )?arrest|(you are|your account is) under investigation|you will regret)\b",
            # New number / lost phone, often used in family impersonation
            r"\b(this is|that'?s) my new (number|phone)\b",
            r"\bi (lost|broke|changed) my (phone|number|sim)\b",
            r"\bi('m| am) using (a |another |my friend'?s |a friend'?s )?(new |different |other )?(number|phone)\b",
            r"\b(text|message|whatsapp|call) me on this (new )?number\b",
        ],
        "explanation": "The message uses fear, secrecy or emotional pressure.",
    },
}

# Words just before a match that turn it into advice or an offer instead of a request,
# e.g. "never share your PIN", "do not send money" or "I'll send the money tomorrow".
NOT_A_REQUEST = re.compile(
    r"\b(never|not|don'?t|won'?t|cannot|can'?t|(i|we)('ll| will))\s+(\w+\s+){0,3}$",
    re.IGNORECASE,
)

# An article right before the action word means it is used as a noun: "thanks for the transfer".
USED_AS_NOUN = re.compile(r"\b(the|a|an|your|my|this|that)\s+$", re.IGNORECASE)


def text_before(message, match):
    return message[max(0, match.start() - 40):match.start()]


def should_skip(message, match, rule):
    before = text_before(message, match)
    if rule.get("skip_advice") and NOT_A_REQUEST.search(before):
        return True
    if rule.get("skip_noun_use") and USED_AS_NOUN.search(before):
        return True
    return False


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
            match = self._first_match(message, rule)
            if match:
                indicators.append(make_indicator(indicator_type, match.group(0), rule["explanation"]))
        return indicators

    def _first_match(self, message, rule):
        for pattern in rule["patterns"]:
            # finditer, so a real request later in the message is still found after a piece of advice.
            for match in re.finditer(pattern, message, re.IGNORECASE):
                if should_skip(message, match, rule):
                    continue
                return match
        return None

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
