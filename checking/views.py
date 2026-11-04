from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .analysis_result import ResultStatus
from .requests import CheckValidationError, MessageCheck, PhoneCheck, URLCheck
from .serializers import (
    AnalysisResultSerializer,
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


class BaseCheckView(APIView):
    # Anyone can check content without an account. Nothing sent here is saved.
    permission_classes = [AllowAny]
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


@extend_schema(request=MessageCheckInputSerializer, responses=AnalysisResultSerializer)
class MessageCheckView(BaseCheckView):
    input_serializer = MessageCheckInputSerializer
    field_name = "message"
    check_class = MessageCheck


@extend_schema(request=URLCheckInputSerializer, responses=AnalysisResultSerializer)
class URLCheckView(BaseCheckView):
    input_serializer = URLCheckInputSerializer
    field_name = "url"
    check_class = URLCheck


@extend_schema(request=PhoneCheckInputSerializer, responses=AnalysisResultSerializer)
class PhoneCheckView(BaseCheckView):
    input_serializer = PhoneCheckInputSerializer
    field_name = "phone_number"
    check_class = PhoneCheck
