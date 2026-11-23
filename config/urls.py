from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from .app_release import AndroidReleaseView
from .frontend import website

admin.site.site_header = "Scam Hunter moderation"
admin.site.site_title = "Scam Hunter admin"
admin.site.index_title = "Review community reports and reference records"

urlpatterns = [
    # The API reference. Locally it is also the first thing you see at http://localhost:8000/
    path("api/", SpectacularRedocView.as_view(url_name="schema"), name="api-reference"),
    path("admin/", admin.site.urls),
    path("api/accounts/", include("accounts.urls")),
    path("api/check/", include("checking.urls")),
    path("api/reports/", include("reporting.urls")),
    path("api/app/android/", AndroidReleaseView.as_view(), name="android-release"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]

if settings.SERVE_FRONTEND:
    # Production: the website answers every other address (/, /check, /report, ...).
    urlpatterns += [re_path(r"^(?!api/|admin/|static/).*$", website, name="website")]
else:
    urlpatterns += [path("", SpectacularRedocView.as_view(url_name="schema"), name="home")]
