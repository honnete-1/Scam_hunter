from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from .app_release import AndroidReleaseView

admin.site.site_header = "Scam Hunter moderation"
admin.site.site_title = "Scam Hunter admin"
admin.site.index_title = "Review community reports and reference records"

urlpatterns = [
    # The API reference is the first thing you see at http://localhost:8000/
    path("", SpectacularRedocView.as_view(url_name="schema"), name="api-reference"),
    path("admin/", admin.site.urls),
    path("api/accounts/", include("accounts.urls")),
    path("api/check/", include("checking.urls")),
    path("api/reports/", include("reporting.urls")),
    path("api/app/android/", AndroidReleaseView.as_view(), name="android-release"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]
