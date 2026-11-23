# Serves the built React website in production, so it shares one address with the API and the admin.
# Every page address (/check, /report, ...) gets index.html; React Router then shows the right page.

from django.conf import settings
from django.http import HttpResponse, HttpResponseNotFound
from django.views.decorators.http import require_safe


@require_safe
def website(request, path=""):
    index = settings.FRONTEND_DIST / "index.html"
    try:
        html = index.read_text(encoding="utf-8")
    except OSError:
        return HttpResponseNotFound("The website has not been built. Run npm run build in frontend/.")
    response = HttpResponse(html)
    # Always fetch the newest page; its script and style files have versioned names and are cached.
    response["Cache-Control"] = "no-cache"
    return response
