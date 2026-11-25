# A tiny "are you awake?" address. The free hosting plan puts the server to sleep after 15 minutes
# without visitors, so the mobile app calls this as soon as it opens: the server starts waking up
# while the user is still typing, and their first check is fast.

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


@extend_schema(
    tags=["App"],
    summary="Server health",
    description="Answers straight away without touching the database. The app calls it on start to wake the server.",
    auth=[],
    responses={200: inline_serializer("Health", {"status": serializers.CharField()})},
)
class HealthView(APIView):
    # No login and no rate limit: an old saved token or a busy phone must never stop the wake-up call.
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = []

    def get(self, request):
        return Response({"status": "ok"})
