# The newest published Android build (APK link + version), saved in a small JSON file so the
# website's download button and QR code always point to the latest build without a restart.

import json

from django.conf import settings
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

EMPTY_RELEASE = {"apk_url": None, "version": None, "build_id": None, "published_at": None}


def read_android_release():
    try:
        with open(settings.ANDROID_RELEASE_FILE, encoding="utf-8") as file:
            data = json.load(file)
    except (OSError, ValueError):
        return dict(EMPTY_RELEASE)
    return {key: data.get(key) for key in EMPTY_RELEASE}


def save_android_release(apk_url, version="", build_id=""):
    release = {
        "apk_url": apk_url,
        "version": version or None,
        "build_id": build_id or None,
        "published_at": timezone.now().isoformat(),
    }
    with open(settings.ANDROID_RELEASE_FILE, "w", encoding="utf-8") as file:
        json.dump(release, file, indent=2)
    return release


class AndroidReleaseSerializer(serializers.Serializer):
    apk_url = serializers.URLField(allow_null=True, help_text="Direct APK download link, or null if nothing is published yet.")
    version = serializers.CharField(allow_null=True)
    build_id = serializers.CharField(allow_null=True, help_text="The Expo (EAS) build id.")
    published_at = serializers.DateTimeField(allow_null=True)


@extend_schema(
    tags=["App"],
    summary="Latest Android app",
    description="The newest published Android build. The website uses it for the download button and QR code.",
    auth=[],
    responses={200: AndroidReleaseSerializer},
)
class AndroidReleaseView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(read_android_release())
