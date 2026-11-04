from django.urls import path

from .views import ApproveReportView, CommunityReportListCreateView, RejectReportView

urlpatterns = [
    path("", CommunityReportListCreateView.as_view(), name="report-list-create"),
    path("<int:pk>/approve/", ApproveReportView.as_view(), name="report-approve"),
    path("<int:pk>/reject/", RejectReportView.as_view(), name="report-reject"),
]
