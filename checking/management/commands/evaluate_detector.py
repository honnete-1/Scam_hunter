from django.core.management.base import BaseCommand

from checking.evaluation.evaluate import EVALUATION_SETS, evaluate_detector


class Command(BaseCommand):
    help = "Run the message detector over the evaluation sets and print the results."

    def add_arguments(self, parser):
        parser.add_argument(
            "--online", action="store_true",
            help="Also use the AI model and online link checks (needs API keys in .env; runs slowly to respect free limits).",
        )
        parser.add_argument("--set", choices=list(EVALUATION_SETS), help="Only run one evaluation set.")

    def handle(self, *args, **options):
        mode = "rules + AI + online checks" if options["online"] else "rules only"
        self.stdout.write(f"Mode: {mode}")
        for set_name in [options["set"]] if options["set"] else EVALUATION_SETS:
            self.print_report(set_name, evaluate_detector(set_name, options["online"]), options["verbosity"])

    def print_report(self, set_name, report, verbosity):
        self.stdout.write(f"\n===== {set_name} set =====")
        self.stdout.write("Suspicious messages")
        self.stdout.write(f"  Total:    {report['suspicious_total']}")
        self.stdout.write(f"  Detected: {report['suspicious_detected']}")
        self.stdout.write(f"  Missed:   {len(report['missed'])}")
        self.stdout.write(f"  Detection rate: {report['detection_rate']:.1%}")

        self.stdout.write("Legitimate messages")
        self.stdout.write(f"  Total:           {report['legitimate_total']}")
        self.stdout.write(f"  False positives: {report['false_positive_count']}")
        self.stdout.write(f"  False-positive rate: {report['false_positive_rate']:.1%}")

        if report["missed"]:
            self.stdout.write("Missed suspicious messages:")
            for row in report["missed"]:
                self.stdout.write(f"  - {row['message']}\n    categories: {row['categories'] or 'none'}")

        if report["false_positives"]:
            self.stdout.write("Legitimate messages that were flagged:")
            for row in report["false_positives"]:
                self.stdout.write(f"  - {row['message']}\n    {row['concern_level']}: {row['categories']}")

        if verbosity > 1:
            self.stdout.write("All suspicious results:")
            for row in report["suspicious_rows"]:
                self.stdout.write(f"  {row['concern_level']:<24} {row['categories']}  {row['message'][:60]}")
