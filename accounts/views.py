from django.contrib.auth import authenticate
from drf_spectacular.utils import OpenApiExample, OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import LoginResponseSerializer, LoginSerializer, RegisterSerializer, UserSerializer


@extend_schema(
    tags=["Accounts"],
    summary="Create an account",
    description="Email is optional. Passwords must pass Django's password rules (at least 8 characters, not too common).",
    auth=[],
    examples=[OpenApiExample("Sign up", value={"username": "aline", "email": "aline@example.com", "password": "a-Strong-passphrase"}, request_only=True)],
    responses={201: UserSerializer, 400: OpenApiResponse(description='Field errors, e.g. {"password": ["This password is too short..."]}.')},
)
class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


@extend_schema(
    tags=["Accounts"],
    summary="Log in",
    description="Returns a token for the Authorization header. Logging in again returns the same token until you log out.",
    auth=[],
    request=LoginSerializer,
    responses={200: LoginResponseSerializer, 401: OpenApiResponse(description="Wrong username or password.")},
)
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            username=serializer.validated_data["username"],
            password=serializer.validated_data["password"],
        )
        if user is None:
            return Response({"detail": "Invalid username or password."}, status=status.HTTP_401_UNAUTHORIZED)

        # The mobile app sends this token in the "Authorization: Token <key>" header.
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "user": UserSerializer(user).data})


@extend_schema(
    tags=["Accounts"],
    summary="Log out",
    description="Deletes the token, so it can no longer be used.",
    request=None,
    responses={204: OpenApiResponse(description="Logged out."), 401: OpenApiResponse(description="Not logged in.")},
)
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Deleting the token means it can no longer be used.
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Accounts"], summary="My profile", description="The logged-in user's details.")
class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user
