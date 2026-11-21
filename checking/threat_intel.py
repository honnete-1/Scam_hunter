# Online cross-checks for links: Google Safe Browsing, abuse.ch URLhaus and domain age (RDAP).
# Each check is optional. Without its key, or if the service fails, it is reported as
# NOT_CONFIGURED or UNAVAILABLE and never counts as "no problem found".

import ipaddress
import re
from dataclasses import dataclass
from datetime import datetime, timezone

from django.conf import settings

from .ai_analyzer import CheckStatus
from .external import ExternalServiceError, request_json
from .requests import CheckValidationError, normalize_url

# A domain younger than this is a common sign of a throwaway scam site.
NEW_DOMAIN_DAYS = 30
MAX_LINKS_PER_MESSAGE = 3

# Links with a scheme or "www.", or bare domains with common TLDs ("bk-help.com/login").
LINK_IN_TEXT = re.compile(
    r"\b(?:https?://\S+|www\.\S+|[a-z0-9-]+(?:\.[a-z0-9-]+)*\."
    r"(?:com|net|org|info|xyz|top|online|site|rw|link|click|app|io|co|me|live|shop|help|support)\b(?:/\S*)?)",
    re.IGNORECASE,
)
# Second-level names under country domains, e.g. "example.co.rw" is the registrable domain.
SECOND_LEVEL = {"co", "ac", "gov", "org", "net", "com", "edu"}


@dataclass
class OnlineCheck:
    id: str
    label: str
    status: str
    finding: bool = False
    detail: str = ""

    def to_dict(self):
        return {"id": self.id, "label": self.label, "status": self.status, "finding": self.finding, "detail": self.detail}


def extract_links(text):
    # Return up to 3 normalized links found in a message, skipping anything that isn't a valid URL.
    links = []
    for raw in LINK_IN_TEXT.findall(text):
        try:
            url = normalize_url(raw.rstrip(".,!?;:)\"'"))
        except CheckValidationError:
            continue
        if url not in links:
            links.append(url)
    return links[:MAX_LINKS_PER_MESSAGE]


def registrable_domain(domain):
    parts = domain.split(".")
    if len(parts) >= 3 and len(parts[-1]) == 2 and parts[-2] in SECOND_LEVEL:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def is_ip(host):
    try:
        ipaddress.ip_address(host.strip("[]"))
        return True
    except ValueError:
        return False


def check_safe_browsing(url):
    check = OnlineCheck("safe_browsing", "Google Safe Browsing", CheckStatus.NOT_CONFIGURED)
    if not (settings.ONLINE_CHECKS_ENABLED and settings.GOOGLE_SAFE_BROWSING_API_KEY):
        return check
    body = {
        "client": {"clientId": "scam-hunter", "clientVersion": "1.0"},
        "threatInfo": {
            "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": url}],
        },
    }
    try:
        data = request_json(
            "https://safebrowsing.googleapis.com/v4/threatMatches:find?key=" + settings.GOOGLE_SAFE_BROWSING_API_KEY,
            method="POST",
            json_body=body,
        )
    except ExternalServiceError:
        check.status = CheckStatus.UNAVAILABLE
        return check
    check.status = CheckStatus.COMPLETED
    matches = data.get("matches") or []
    if matches:
        check.finding = True
        check.detail = "Listed by Google as " + matches[0].get("threatType", "unsafe").replace("_", " ").lower()
    return check


def check_urlhaus(domain):
    check = OnlineCheck("urlhaus", "URLhaus malware list", CheckStatus.NOT_CONFIGURED)
    if not (settings.ONLINE_CHECKS_ENABLED and settings.URLHAUS_AUTH_KEY):
        return check
    try:
        data = request_json(
            "https://urlhaus-api.abuse.ch/v1/host/",
            method="POST",
            form_body={"host": domain},
            headers={"Auth-Key": settings.URLHAUS_AUTH_KEY},
        )
    except ExternalServiceError:
        check.status = CheckStatus.UNAVAILABLE
        return check
    if data.get("query_status") not in ("ok", "no_results"):
        check.status = CheckStatus.UNAVAILABLE
        return check
    check.status = CheckStatus.COMPLETED
    count = int(data.get("url_count") or 0) if data.get("query_status") == "ok" else 0
    if count > 0:
        check.finding = True
        check.detail = f"This website has {count} harmful link(s) listed by URLhaus"
    return check


def check_domain_age(domain):
    check = OnlineCheck("domain_age", "Website age", CheckStatus.NOT_CONFIGURED)
    if not settings.ONLINE_CHECKS_ENABLED:
        return check
    if is_ip(domain):
        check.status = CheckStatus.UNAVAILABLE
        check.detail = "An IP address has no registration date"
        return check
    try:
        data = request_json("https://rdap.org/domain/" + registrable_domain(domain))
        # RDAP lists dated events; the "registration" event is when the domain was created.
        created = next(e["eventDate"] for e in data.get("events", []) if e.get("eventAction") == "registration")
        created_at = datetime.fromisoformat(created.replace("Z", "+00:00"))
    except (ExternalServiceError, StopIteration, KeyError, ValueError):
        check.status = CheckStatus.UNAVAILABLE
        return check
    check.status = CheckStatus.COMPLETED
    age_days = (datetime.now(timezone.utc) - created_at).days
    check.detail = f"Registered {age_days} day(s) ago"
    check.finding = age_days < NEW_DOMAIN_DAYS
    return check


def run_link_checks(url, domain):
    return [check_safe_browsing(url), check_urlhaus(domain), check_domain_age(domain)]
