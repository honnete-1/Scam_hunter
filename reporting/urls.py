from django.urls import path

from .views import (
    ApproveReportView, CommunityReportListCreateView, CommunityStatsView, PublicAlertsView, RejectReportView,
    RemovalRequestListCreateView, ScamNumberListView,
)

urlpatterns = [
    path("", CommunityReportListCreateView.as_view(), name="report-list-create"),
    path("alerts/", PublicAlertsView.as_view(), name="report-alerts"),
    path("scam-numbers/", ScamNumberListView.as_view(), name="report-scam-numbers"),
    path("stats/", CommunityStatsView.as_view(), name="report-stats"),
    path("removal-requests/", RemovalRequestListCreateView.as_view(), name="removal-requests"),
    path("<int:pk>/approve/", ApproveReportView.as_view(), name="report-approve"),
    path("<int:pk>/reject/", RejectReportView.as_view(), name="report-reject"),
]
