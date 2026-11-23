from django.core.management.base import BaseCommand, CommandError

from config.app_release import read_android_release, save_android_release


class Command(BaseCommand):
    help = "Publish an Android APK link, so the website's download button and QR code show this build."

    def add_arguments(self, parser):
        parser.add_argument("--url", help="Direct APK link from Expo, e.g. https://expo.dev/artifacts/eas/....apk")
        parser.add_argument("--app-version", default="", help="App version shown on the website, e.g. 1.2.0.")
        parser.add_argument("--build-id", default="", help="The EAS build id (optional).")
        parser.add_argument("--show", action="store_true", help="Only print the build that is published now.")

    def handle(self, *args, **options):
        if options["show"]:
            self.stdout.write(str(read_android_release()))
            return
        url = (options["url"] or "").strip()
        # Only https links, so the QR code can never send people to a plain-HTTP download.
        if not url.startswith("https://"):
            raise CommandError("Give the APK link with --url, starting with https://")
        release = save_android_release(url, options["app_version"].strip(), options["build_id"].strip())
        self.stdout.write(self.style.SUCCESS(f"Published Android build {release['version'] or ''}: {url}"))
