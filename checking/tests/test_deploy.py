import tempfile
from pathlib import Path
from unittest import mock

from django.test import RequestFactory, SimpleTestCase, TestCase, override_settings

from config.app_release import read_android_release
from config.frontend import website
from reporting.storage import DatabaseStorage


class WebsiteViewTests(SimpleTestCase):
    # In production Django answers every page address with the built website's index.html.
    def test_serves_index_html_for_any_page(self):
        with tempfile.TemporaryDirectory() as folder:
            Path(folder, "index.html").write_text("<div id=root></div>", encoding="utf-8")
            with override_settings(FRONTEND_DIST=Path(folder)):
                response = website(RequestFactory().get("/check"), "check")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"<div id=root></div>")
        self.assertEqual(response["Cache-Control"], "no-cache")

    def test_missing_build_is_a_clear_404(self):
        with override_settings(FRONTEND_DIST=Path(tempfile.gettempdir()) / "no-such-build"):
            response = website(RequestFactory().get("/"))
        self.assertEqual(response.status_code, 404)


class ReleaseFromEnvironmentTests(SimpleTestCase):
    # On Render the release file is gone after each deploy, so environment variables are used.
    def test_uses_environment_when_there_is_no_file(self):
        env = {"SCAM_HUNTER_ANDROID_APK_URL": "https://expo.dev/artifacts/eas/app.apk", "SCAM_HUNTER_ANDROID_VERSION": "1.2.3"}
        with override_settings(ANDROID_RELEASE_FILE=Path(tempfile.gettempdir()) / "missing-release.json"), \
                mock.patch.dict("os.environ", env):
            release = read_android_release()
        self.assertEqual((release["apk_url"], release["version"]), (env["SCAM_HUNTER_ANDROID_APK_URL"], "1.2.3"))

    def test_ignores_links_that_are_not_https(self):
        with override_settings(ANDROID_RELEASE_FILE=Path(tempfile.gettempdir()) / "missing-release.json"), \
                mock.patch.dict("os.environ", {"SCAM_HUNTER_ANDROID_APK_URL": "http://example.com/app.apk"}):
            self.assertIsNone(read_android_release()["apk_url"])


class DatabaseStorageTests(TestCase):
    def test_files_round_trip_through_the_database(self):
        from django.core.files.base import ContentFile

        storage = DatabaseStorage()
        name = storage.save("removal_proofs/test.pdf", ContentFile(b"%PDF-1.4 test"))
        self.assertTrue(storage.exists(name))
        self.assertEqual(storage.size(name), 13)
        with storage.open(name) as file:
            self.assertEqual(file.read(), b"%PDF-1.4 test")
        storage.delete(name)
        self.assertFalse(storage.exists(name))
        with self.assertRaises(NotImplementedError):
            storage.url(name)
