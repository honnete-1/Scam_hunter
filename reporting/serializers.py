from rest_framework import serializers

from pathlib import Path

from checking.requests import CheckValidationError, MessageCheck, PhoneCheck, URLCheck, normalize_phone_number

from .models import CommunityReport, RemovalRequest, RemovalRequestStatus, ReportType, ReviewMode
from .services import MAX_DIRECT_REPORTS_PER_DAY, direct_reports_today, is_on_scam_list

# Reports reuse the same validation as normal checks, so a reported URL
# or phone number is always in a form the reference records can use.
CHECK_CLASS_FOR_REPORT_TYPE = {
    ReportType.MESSAGE: MessageCheck,
    ReportType.URL: URLCheck,
    ReportType.PHONE: PhoneCheck,
}


class CommunityReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommunityReport
        fields = ["id", "report_type", "content", "details", "review_mode", "status", "created_at", "updated_at"]
        read_only_fields = ["status", "created_at", "updated_at"]
        extra_kwargs = {"review_mode": {
            "required": False,
            "help_text": "MODERATED (default): a moderator checks it first. DIRECT: phone numbers only, approved at once "
                         f"so the number is flagged immediately; at most {MAX_DIRECT_REPORTS_PER_DAY} per account per day.",
        }}

    def validate(self, data):
        check_class = CHECK_CLASS_FOR_REPORT_TYPE[data["report_type"]]
        try:
            check_class(data["content"]).validate()
        except CheckValidationError as error:
            raise serializers.ValidationError({"content": str(error)})

        if data.get("review_mode") == ReviewMode.DIRECT:
            if data["report_type"] != ReportType.PHONE:
                raise serializers.ValidationError({"review_mode": "Only phone numbers can be reported directly."})
            user = self.context["request"].user
            if direct_reports_today(user) >= MAX_DIRECT_REPORTS_PER_DAY:
                raise serializers.ValidationError({"review_mode": (
                    f"You can make {MAX_DIRECT_REPORTS_PER_DAY} direct reports per day. Send this one for verification instead."
                )})
        return data


MAX_PROOF_BYTES = 5 * 1024 * 1024
# The first bytes of each allowed file type, so a renamed program cannot pass as a "letter".
PROOF_SIGNATURES = {
    ".pdf": [b"%PDF-"],
    ".png": [b"\x89PNG\r\n\x1a\n"],
    ".jpg": [b"\xff\xd8\xff"],
    ".jpeg": [b"\xff\xd8\xff"],
}


class RemovalRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = RemovalRequest
        fields = ["id", "phone_number", "full_name", "contact", "explanation", "proof", "status", "moderator_note",
                  "created_at", "reviewed_at"]
        read_only_fields = ["status", "moderator_note", "created_at", "reviewed_at"]
        extra_kwargs = {
            "proof": {"write_only": True, "help_text": "A photo or PDF of the proof (JPG, PNG or PDF, at most 5 MB)."},
            "phone_number": {"help_text": "The number to remove, in any format, e.g. 0788 123 456 or +250788123456."},
            "explanation": {"help_text": "Why the number was reported by mistake."},
        }

    def validate_phone_number(self, value):
        try:
            number = normalize_phone_number(value)
        except CheckValidationError as error:
            raise serializers.ValidationError(str(error))
        if not is_on_scam_list(number):
            raise serializers.ValidationError("This number is not on the scam list, so there is nothing to remove.")
        user = self.context["request"].user
        if RemovalRequest.objects.filter(
            submitted_by=user, phone_number=number, status=RemovalRequestStatus.PENDING
        ).exists():
            raise serializers.ValidationError("You already sent a request for this number. A moderator will review it soon.")
        return number

    def validate_proof(self, file):
        extension = Path(file.name or "").suffix.lower()
        if extension not in PROOF_SIGNATURES:
            raise serializers.ValidationError("Please upload a JPG, PNG or PDF file.")
        if file.size > MAX_PROOF_BYTES:
            raise serializers.ValidationError("The file is too large. The limit is 5 MB.")
        start = file.read(8)
        file.seek(0)
        if not any(start.startswith(signature) for signature in PROOF_SIGNATURES[extension]):
            raise serializers.ValidationError("This file is not a real JPG, PNG or PDF.")
        return file


class ModerationInputSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)


# The serializers I put below only describe responses for the API documentation.

class PublicAlertSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    report_type = serializers.ChoiceField(choices=ReportType.choices)
    content = serializers.CharField(help_text="Links and numbers as reported; numbers and emails inside messages are hidden.")
    approved_at = serializers.DateTimeField(help_text="When a moderator approved the report.")


class ApprovedByTypeSerializer(serializers.Serializer):
    MESSAGE = serializers.IntegerField()
    URL = serializers.IntegerField()
    PHONE = serializers.IntegerField()


class CommunityStatsSerializer(serializers.Serializer):
    approved_reports = serializers.IntegerField()
    approved_by_type = ApprovedByTypeSerializer()
    pending_reports = serializers.IntegerField(help_text="Waiting for a moderator; they affect nothing yet.")
    suspicious_links = serializers.IntegerField(help_text="Active approved URL reference records.")
    suspicious_numbers = serializers.IntegerField(help_text="Active approved phone reference records.")


class ScamNumberSerializer(serializers.Serializer):
    phone_number = serializers.CharField(help_text="Normalized number, e.g. +250788444999.")
    reports = serializers.IntegerField(help_text="Approved community reports naming this number (0 if a moderator added it).")


class ScamNumberListSerializer(serializers.Serializer):
    generated_at = serializers.DateTimeField()
    count = serializers.IntegerField()
    numbers = ScamNumberSerializer(many=True)


class DetailSerializer(serializers.Serializer):
    detail = serializers.CharField()
