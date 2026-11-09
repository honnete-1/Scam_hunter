from rest_framework import serializers

from checking.requests import CheckValidationError, MessageCheck, PhoneCheck, URLCheck

from .models import CommunityReport, ReportType

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
        fields = ["id", "report_type", "content", "details", "status", "created_at", "updated_at"]
        read_only_fields = ["status", "created_at", "updated_at"]

    def validate(self, data):
        check_class = CHECK_CLASS_FOR_REPORT_TYPE[data["report_type"]]
        try:
            check_class(data["content"]).validate()
        except CheckValidationError as error:
            raise serializers.ValidationError({"content": str(error)})
        return data


class ModerationInputSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)
