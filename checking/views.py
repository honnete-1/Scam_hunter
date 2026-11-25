from drf_spectacular.utils import OpenApiExample, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .analysis_result import ResultStatus
from .requests import CheckValidationError, MessageCheck, PhoneCheck, URLCheck
from .serializers import (
    AnalysisResultSerializer,
    InvalidInputSerializer,
    MessageCheckInputSerializer,
    PhoneCheckInputSerializer,
    URLCheckInputSerializer,
)
from .services import AnalysisService


def invalid_input_response(errors):
    # Invalid input gets no concern level at all, so it can't be mistaken for a safe result.
    return Response(
        {"status": "INVALID_INPUT", "concern_level": None, "errors": errors},
        status=status.HTTP_400_BAD_REQUEST,
    )


# ---- API documentation for the three check endpoints ----

EXAMPLE_HIGH = {
    "status": "SUCCESS",
    "concern_level": "HIGH_CONCERN",
    "indicators": [
        {"type": "urgency", "evidence": "account will be suspended", "explanation": "The message pressures you to act quickly."},
        {"type": "sensitive_information_request", "evidence": "Reply with your OTP", "explanation": "The message asks for sensitive account information such as a password, PIN or code."},
        {"type": "impersonation", "evidence": "This is MTN Customer Care", "explanation": "The sender appears to claim they represent a trusted organisation."},
    ],
    "reference_match": False,
    "explanation": "This message uses urgent language, asks for private information such as a password, PIN or code and appears to claim it comes from a known organisation.",
    "safer_action": "Never share passwords, PINs or one-time codes (OTPs), even if the request looks official. Contact the organisation using its official website or phone number, not the details in the message.",
    "checks": [
        {"id": "rules", "label": "Scam-pattern rules", "status": "COMPLETED", "finding": True, "detail": ""},
        {"id": "community", "label": "Community reports", "status": "COMPLETED", "finding": False, "detail": ""},
        {"id": "ai", "label": "AI analysis", "status": "COMPLETED", "finding": True, "detail": "It asks for your one-time code, a common scam tactic. (95% confidence)"},
    ],
    "reputation": None,
    "ai_score": 95,
    "headline": "Warning: this looks like a scam",
    "language": "en",
    "english": None,
}

EXAMPLE_UNAVAILABLE = {
    "status": "CHECK_UNAVAILABLE",
    "concern_level": None,
    "indicators": [],
    "reference_match": False,
    "explanation": "The reference lookup could not be completed, so no concern level was given.",
    "safer_action": "Do not rely on this check yet. Verify the sender or destination independently.",
    "checks": [{"id": "reference", "label": "Approved suspicious numbers", "status": "UNAVAILABLE", "finding": False, "detail": ""}],
    "reputation": None,
    "ai_score": None,
    "headline": "The check could not be completed",
    "language": None,
    "english": None,
}


def check_docs(summary, description, request_serializer, field, request_example, invalid_message):
    return extend_schema(
        tags=["Checks"],
        summary=summary,
        description=description,
        auth=[],
        request=request_serializer,
        responses={
            200: OpenApiResponse(AnalysisResultSerializer, description="Analysis completed."),
            400: OpenApiResponse(InvalidInputSerializer, description="The input could not be checked."),
            503: OpenApiResponse(AnalysisResultSerializer, description="A required lookup failed: status is CHECK_UNAVAILABLE."),
        },
        examples=[
            OpenApiExample("Request", value={field: request_example}, request_only=True),
            OpenApiExample("High concern", value=EXAMPLE_HIGH, response_only=True, status_codes=["200"]),
            OpenApiExample(
                "Invalid input",
                value={"status": "INVALID_INPUT", "concern_level": None, "errors": {field: [invalid_message]}},
                response_only=True,
                status_codes=["400"],
            ),
            OpenApiExample("Check unavailable", value=EXAMPLE_UNAVAILABLE, response_only=True, status_codes=["503"]),
        ],
    )


class BaseCheckView(APIView):
    # Anyone can check content without an account. Nothing sent here is saved.
    permission_classes = [AllowAny]
    throttle_scope = "check"
    input_serializer = None
    field_name = None
    check_class = None

    def post(self, request):
        serializer = self.input_serializer(data=request.data)
        if not serializer.is_valid():
            return invalid_input_response(serializer.errors)

        check_request = self.check_class(serializer.validated_data[self.field_name])
        try:
            result = AnalysisService().analyze(check_request)
        except CheckValidationError as error:
            return invalid_input_response({self.field_name: [str(error)]})

        # 503 tells the client the check could not be completed reliably.
        if result.status == ResultStatus.CHECK_UNAVAILABLE:
            http_status = status.HTTP_503_SERVICE_UNAVAILABLE
        else:
            http_status = status.HTTP_200_OK
        return Response(result.to_dict(), status=http_status)


@check_docs(
    "Check a message",
    "Looks for scam-like behaviour (urgency, PIN/OTP or payment requests, impersonation, fake prizes, threats), "
    "checks any links inside the message, compares it with confirmed community reports and, if configured, "
    "asks an AI model for a second opinion. The message is not stored.",
    MessageCheckInputSerializer,
    "message",
    "This is MTN Customer Care. Your account will be suspended within 30 minutes. Reply with your OTP.",
    "Please enter a message before checking.",
)
class MessageCheckView(BaseCheckView):
    input_serializer = MessageCheckInputSerializer
    field_name = "message"
    check_class = MessageCheck


@check_docs(
    "Check a link",
    "Inspects the link's structure (IP addresses, hidden destinations, look-alike characters, shorteners, "
    "official-sounding words), matches it against approved suspicious links and, if configured, checks Google "
    "Safe Browsing, URLhaus and the website's age. The link is not opened or stored.",
    URLCheckInputSerializer,
    "url",
    "http://bk-secure-login.example/verify",
    "Enter a valid URL, for example https://example.com.",
)
class URLCheckView(BaseCheckView):
    input_serializer = URLCheckInputSerializer
    field_name = "url"
    check_class = URLCheck


@check_docs(
    "Check a phone number",
    "Normalizes the number (Rwanda numbers become +2507XXXXXXXX) and matches it against numbers approved as "
    "suspicious by moderators. The response includes the number's community reputation. The number is not stored.",
    PhoneCheckInputSerializer,
    "phone_number",
    "0788 444 999",
    "Enter a valid phone number, for example +250 788 123 456.",
)
class PhoneCheckView(BaseCheckView):
    input_serializer = PhoneCheckInputSerializer
    field_name = "phone_number"
    check_class = PhoneCheck
