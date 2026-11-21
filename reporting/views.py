from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiExample, OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CommunityReport
from .serializers import (
    CommunityReportSerializer, CommunityStatsSerializer, DetailSerializer, ModerationInputSerializer, PublicAlertSerializer,
)
from .services import (
    ModerationError, approve_report, community_stats, public_alerts, reject_report, submit_report,
)


@extend_schema_view(
    get=extend_schema(
        tags=["Community reports"],
        summary="List my reports",
        description="Reports submitted by the logged-in user, newest first, with their review status.",
        responses={200: CommunityReportSerializer(many=True), 401: OpenApiResponse(DetailSerializer, description="Not logged in.")},
    ),
    post=extend_schema(
        tags=["Community reports"],
        summary="Submit a report",
        description=(
            "Deliberately reports suspicious content. It is stored with status PENDING and affects nothing until a "
            "moderator approves it. The content is validated like a check of the same type."
        ),
        examples=[OpenApiExample(
            "Report a phone number",
            value={"report_type": "PHONE", "content": "+250 788 444 999", "details": "Called claiming to be MTN and asked for my PIN."},
            request_only=True,
        )],
        responses={
            201: CommunityReportSerializer,
            400: OpenApiResponse(description="Invalid type or content, e.g. {\"content\": [\"Enter a valid URL...\"]}."),
            401: OpenApiResponse(DetailSerializer, description="Not logged in."),
        },
    ),
)
class CommunityReportListCreateView(generics.ListCreateAPIView):
    # You must be logged in to submit a report, and you only see your own reports.
    serializer_class = CommunityReportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CommunityReport.objects.filter(submitted_by=self.request.user)

    def perform_create(self, serializer):
        data = serializer.validated_data
        serializer.instance = submit_report(
            self.request.user, data["report_type"], data["content"], data.get("details", "")
        )


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


def moderation_docs(summary, description):
    return extend_schema(
        tags=["Moderation"],
        summary=summary,
        description=description,
        request=ModerationInputSerializer,
        responses={
            200: CommunityReportSerializer,
            403: OpenApiResponse(DetailSerializer, description="Staff only."),
            404: OpenApiResponse(DetailSerializer, description="No report with this id."),
            409: OpenApiResponse(DetailSerializer, description="The report has already been reviewed."),
        },
    )


@moderation_docs(
    "Approve a report",
    "Marks a pending report APPROVED and records the review. Approved URL and phone reports create (or reactivate) "
    "a reference record, so future checks of that link or number return HIGH_CONCERN.",
)
class ApproveReportView(BaseModerationView):
    moderate = staticmethod(approve_report)


@moderation_docs(
    "Reject a report",
    "Marks a pending report REJECTED and records the review. Rejected reports never affect any result.",
)
class RejectReportView(BaseModerationView):
    moderate = staticmethod(reject_report)


@extend_schema(
    tags=["Community reports"],
    summary="Public scam alerts",
    description="The 20 most recently approved reports. Pending and rejected reports and reporters' identities are never shown.",
    auth=[],
    responses={200: PublicAlertSerializer(many=True)},
)
class PublicAlertsView(APIView):
    # Anyone can read the alerts feed; it only contains moderator-approved reports.
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(public_alerts())


@extend_schema(
    tags=["Community reports"],
    summary="Community statistics",
    description="Real counts from the database: approved and pending reports, and active reference records.",
    auth=[],
    responses={200: CommunityStatsSerializer},
)
class CommunityStatsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(community_stats())
