from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CommunityReport
from .serializers import CommunityReportSerializer, ModerationInputSerializer
from .services import ModerationError, approve_report, reject_report, submit_report


class CommunityReportListCreateView(generics.ListCreateAPIView):
    # You must be logged in to submit a report, and you only see your own reports.
    serializer_class = CommunityReportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CommunityReport.objects.filter(submitted_by=self.request.user)

    def perform_create(self, serializer):
        data = serializer.validated_data
        serializer.instance = submit_report(self.request.user, data["report_type"], data["content"])


class BaseModerationView(APIView):
    # Only staff (moderators) can review reports.
    permission_classes = [IsAdminUser]
    moderate = None

    def post(self, request, pk):
        report = get_object_or_404(CommunityReport, pk=pk)
        serializer = ModerationInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            report = self.moderate(report, request.user, serializer.validated_data.get("reason", ""))
        except ModerationError as error:
            return Response({"detail": str(error)}, status=status.HTTP_409_CONFLICT)
        return Response(CommunityReportSerializer(report).data)


@extend_schema(request=ModerationInputSerializer, responses=CommunityReportSerializer)
class ApproveReportView(BaseModerationView):
    moderate = staticmethod(approve_report)


@extend_schema(request=ModerationInputSerializer, responses=CommunityReportSerializer)
class RejectReportView(BaseModerationView):
    moderate = staticmethod(reject_report)
