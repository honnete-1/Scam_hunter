# Small helpers for calling outside services (AI model, link reputation, domain age).
# Uses only the standard library. Every failure becomes ExternalServiceError, so callers
# can say "this check could not run" instead of crashing or pretending it passed.

import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

DEFAULT_TIMEOUT = 8


class ExternalServiceError(Exception):
    pass


def request_json(url, method="GET", json_body=None, form_body=None, headers=None, timeout=DEFAULT_TIMEOUT):
    headers = {"Accept": "application/json", "User-Agent": "ScamHunter/1.0", **(headers or {})}
    data = None
    if json_body is not None:
        data = json.dumps(json_body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    elif form_body is not None:
        data = urlencode(form_body).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"

    try:
        with urlopen(Request(url, data=data, headers=headers, method=method), timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8") or "{}")
    except HTTPError as error:
        # Keep the status code (e.g. 404 or 429) so callers can explain what happened.
        raise ExternalServiceError(f"HTTP {error.code}") from error
    except (URLError, TimeoutError, OSError, ValueError) as error:
        raise ExternalServiceError(str(error)) from error
