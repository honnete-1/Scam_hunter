# Check requests are plain Python classes, not models, so checked content is never saved.
# Only deliberately submitted Community Reports are stored.

import ipaddress
import re
from urllib.parse import urlsplit

MAX_MESSAGE_LENGTH = 5000

INVALID_URL_ERROR = "Enter a valid URL, for example https://example.com."
INVALID_PHONE_ERROR = "Enter a valid phone number, for example +250 788 123 456."

# Normal hostnames like "example.com" or "mail.bank.co.rw" (after IDNA encoding).
HOSTNAME_PATTERN = re.compile(r"^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]([a-z0-9-]*[a-z0-9])?$")

# E.164 allows at most 15 digits. Fewer than 7 digits is too short to be a real number.
PHONE_PATTERN = re.compile(r"^\+?\d{7,15}$")

# 0788123456 (local) and 250788123456 (country code without +).
RWANDA_LOCAL_MOBILE = re.compile(r"^07[2389]\d{7}$")
RWANDA_MOBILE_WITHOUT_PLUS = re.compile(r"^2507[2389]\d{7}$")


# Raised when input cannot be checked. It must never become a normal result.
class CheckValidationError(ValueError):
    pass


def normalize_url(url):
    # Normalize a URL so different spellings of the same address can be matched.
    text = url.strip()
    if not text:
        raise CheckValidationError("Please enter a URL.")
    if any(char.isspace() for char in text):
        raise CheckValidationError("A URL cannot contain spaces.")

    # People often paste "example.com/login" without a scheme.
    if "://" not in text:
        text = "http://" + text

    parts = urlsplit(text)
    scheme = parts.scheme.lower()
    if scheme not in ("http", "https"):
        raise CheckValidationError("Only http and https URLs can be checked.")

    try:
        host = parts.hostname
        port = parts.port
    except ValueError:
        # urlsplit raises ValueError for things like a non-numeric port.
        raise CheckValidationError(INVALID_URL_ERROR)

    if not host:
        raise CheckValidationError(INVALID_URL_ERROR)

    host = _normalize_host(host)

    # Keep any "user@" part because it is a warning sign the rule engine looks for.
    userinfo = ""
    if "@" in parts.netloc:
        userinfo = parts.netloc.rsplit("@", 1)[0] + "@"

    netloc = userinfo + host
    default_port = 80 if scheme == "http" else 443
    if port and port != default_port:
        netloc += f":{port}"

    normalized = f"{scheme}://{netloc}{parts.path.rstrip('/')}"
    if parts.query:
        normalized += "?" + parts.query
    # The #fragment is dropped because it never reaches the server.
    return normalized


def _normalize_host(host):
    # Lowercase the host and convert international characters to punycode (xn--).
    try:
        ip = ipaddress.ip_address(host)
        return f"[{ip}]" if ip.version == 6 else str(ip)
    except ValueError:
        pass

    try:
        host = host.encode("idna").decode("ascii").lower()
    except UnicodeError:
        raise CheckValidationError(INVALID_URL_ERROR)

    if not HOSTNAME_PATTERN.match(host):
        raise CheckValidationError(INVALID_URL_ERROR)
    return host


def extract_domain(url):
    # Get the domain from a URL, ignoring a leading "www." so both forms match.
    host = urlsplit(normalize_url(url)).hostname
    if host.startswith("www."):
        host = host[4:]
    return host


def normalize_phone_number(phone_number):
    # Normalize a phone number before reference matching.
    text = phone_number.strip()
    if not text:
        raise CheckValidationError("Please enter a phone number.")

    # Remove separators people commonly type: spaces, dashes, dots and brackets.
    cleaned = re.sub(r"[\s\-.()]", "", text)

    # "00" is the international dialling prefix, the same as "+".
    if cleaned.startswith("00"):
        cleaned = "+" + cleaned[2:]

    # Rwanda mobile numbers (072, 073, 078, 079) are stored as +2507XXXXXXXX so every
    # common way of writing the same number matches. Other numbers are left as they are.
    if RWANDA_LOCAL_MOBILE.match(cleaned):
        cleaned = "+250" + cleaned[1:]
    elif RWANDA_MOBILE_WITHOUT_PLUS.match(cleaned):
        cleaned = "+" + cleaned

    if not PHONE_PATTERN.match(cleaned):
        raise CheckValidationError(INVALID_PHONE_ERROR)
    return cleaned


# Base class for anything a user can check.
class CheckRequest:
    check_type = None
    empty_error = "Please enter something to check."

    def __init__(self, input_text):
        self.input = input_text
        self.normalized = None

    def validate(self):
        # Shared rule for every check: there must be some actual text.
        if not isinstance(self.input, str) or not self.input.strip():
            raise CheckValidationError(self.empty_error)

    def normalize(self):
        self.normalized = self.input.strip()
        return self.normalized


class MessageCheck(CheckRequest):
    check_type = "MESSAGE"
    empty_error = "Please enter a message before checking."

    def validate(self):
        super().validate()
        if len(self.input) > MAX_MESSAGE_LENGTH:
            raise CheckValidationError(
                f"Messages can be at most {MAX_MESSAGE_LENGTH} characters long."
            )

    def normalize(self):
        # Collapse repeated spaces and line breaks so the rules see clean text.
        self.normalized = " ".join(self.input.split())
        return self.normalized


class URLCheck(CheckRequest):
    check_type = "URL"
    empty_error = "Please enter a URL before checking."

    def __init__(self, input_text):
        super().__init__(input_text)
        self.domain = None

    def validate(self):
        super().validate()
        normalize_url(self.input)

    def normalize(self):
        self.normalized = normalize_url(self.input)
        self.domain = extract_domain(self.normalized)
        return self.normalized


class PhoneCheck(CheckRequest):
    check_type = "PHONE"
    empty_error = "Please enter a phone number before checking."

    def validate(self):
        super().validate()
        normalize_phone_number(self.input)

    def normalize(self):
        self.normalized = normalize_phone_number(self.input)
        return self.normalized
