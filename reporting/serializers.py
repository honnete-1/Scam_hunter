from rest_framework import serializers

from checking.requests import CheckValidationError, MessageCheck, PhoneCheck, URLCheck

from .models import CommunityReport, ReportType, ReviewMode
from .services import MAX_DIRECT_REPORTS_PER_DAY, direct_reports_today

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


class ModerationInputSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)


# The serializers below only describe responses for the API documentation.

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
