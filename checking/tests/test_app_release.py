import tempfile
from io import StringIO
from pathlib import Path

from django.core.management import CommandError, call_command
from django.test import override_settings
from rest_framework.test import APITestCase

APK = "https://expo.dev/artifacts/eas/example.apk"


class AndroidReleaseTests(APITestCase):
    # Each test uses its own temporary release file, never the real one.
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        override = override_settings(ANDROID_RELEASE_FILE=Path(folder.name) / "android_release.json")
        override.enable()
        self.addCleanup(override.disable)

    def test_nothing_is_published_at_first(self):
        response = self.client.get("/api/app/android/")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["apk_url"])

    def test_published_build_is_served_to_the_website(self):
        call_command("publish_android_build", url=APK, app_version="1.2.0", build_id="abc", stdout=StringIO())
        data = self.client.get("/api/app/android/").data
        self.assertEqual(data["apk_url"], APK)
        self.assertEqual(data["version"], "1.2.0")
        self.assertEqual(data["build_id"], "abc")
        self.assertIsNotNone(data["published_at"])

    def test_a_newer_build_replaces_the_old_one(self):
        call_command("publish_android_build", url=APK, app_version="1.1.0", stdout=StringIO())
        call_command("publish_android_build", url="https://expo.dev/artifacts/eas/newer.apk", app_version="1.2.0", stdout=StringIO())
        self.assertEqual(self.client.get("/api/app/android/").data["version"], "1.2.0")

    def test_only_https_links_are_accepted(self):
        with self.assertRaises(CommandError):
            call_command("publish_android_build", url="http://example.com/app.apk", stdout=StringIO())
        self.assertIsNone(self.client.get("/api/app/android/").data["apk_url"])
