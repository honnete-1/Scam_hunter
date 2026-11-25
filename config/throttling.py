# Rate limits: how many checks, reports and logins one person can send in a period of time.
# They stop someone from flooding the moderators with fake reports, guessing passwords, or
# running up the AI model's cost. Normal use stays far below them.
#
# A view opts in with throttle_scope = "<name>", and the limit for each name is set in
# SCAM_HUNTER_RATE_LIMITS in settings.py. A logged-in person is counted by account, anyone
# else by IP address.

from django.conf import settings
from django.core.cache import caches
from rest_framework.exceptions import Throttled
from rest_framework.permissions import SAFE_METHODS
from rest_framework.throttling import ScopedRateThrottle


class ScamHunterRateThrottle(ScopedRateThrottle):
    # A shared cache, so every server worker counts the same requests.
    cache = caches["rate_limits"]

    def allow_request(self, request, view):
        # Only sending something is limited. Reading lists (e.g. "My reports") never is.
        if request.method in SAFE_METHODS:
            return True
        return super().allow_request(request, view)

    def get_rate(self):
        # Read at request time, so tests can change the limits with override_settings.
        return settings.SCAM_HUNTER_RATE_LIMITS.get(self.scope)


def rate_limit_message(wait):
    if wait is None:
        return "Too many requests. Please wait a moment and try again."
    seconds = max(1, round(wait))
    if seconds >= 120:
        return f"Too many requests. Please wait about {round(seconds / 60)} minutes and try again."
    return f"Too many requests. Please wait {seconds} seconds and try again."


def exception_handler(exc, context):
    # Same as DRF's handler, but with a plain-language message when a rate limit is reached.
    # Imported here because rest_framework.views itself loads this file through the settings.
    from rest_framework.views import exception_handler as drf_exception_handler

    response = drf_exception_handler(exc, context)
    if isinstance(exc, Throttled) and response is not None:
        response.data = {"detail": rate_limit_message(exc.wait)}
    return response
