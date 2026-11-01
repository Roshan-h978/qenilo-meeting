import re

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db import transaction
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import serializers
from rest_framework.throttling import SimpleRateThrottle

from accounts.models import ExternalIdentity
from accounts.serializers import RegistrationSerializer

User = get_user_model()


class AuthRateThrottle(SimpleRateThrottle):
    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class LoginRateThrottle(AuthRateThrottle):
    scope = "auth_login"


class RegistrationRateThrottle(AuthRateThrottle):
    scope = "auth_register"


class GoogleRateThrottle(AuthRateThrottle):
    scope = "auth_google"


class GoogleCredentialSerializer(serializers.Serializer):
    credential = serializers.CharField(max_length=10000, trim_whitespace=True)


class SignInSerializer(serializers.Serializer):
    identifier = serializers.CharField(max_length=254, trim_whitespace=True)
    password = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True)


def user_data(user):
    return {"id": user.pk, "username": user.username, "email": user.email}


@ensure_csrf_cookie
@api_view(["GET"])
@permission_classes([AllowAny])
def csrf_token(request):
    return Response({"csrfToken": get_token(request)})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([RegistrationRateThrottle])
@csrf_protect
def register(request):
    serializer = RegistrationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    login(request, user)
    return Response({"user": user_data(user)}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
@csrf_protect
def sign_in(request):
    serializer = SignInSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    identifier = serializer.validated_data["identifier"]
    password = serializer.validated_data["password"]
    if not identifier:
        return Response({"detail": "Enter your username or email and password."}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(username__iexact=identifier).first()
    if user is None and "@" in identifier:
        user = User.objects.filter(email__iexact=identifier).first()
    authenticated_user = authenticate(request, username=user.username if user else identifier, password=password)
    if authenticated_user is None:
        return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

    login(request, authenticated_user)
    return Response({"user": user_data(authenticated_user)})


def google_username(email, subject):
    stem = re.sub(r"[^a-zA-Z0-9_]+", "_", email.split("@", 1)[0]).strip("_")[:120] or "google_user"
    candidate = stem
    suffix = 1
    while User.objects.filter(username__iexact=candidate).exists():
        candidate = f"{stem[:130]}_{subject[-8:]}" if suffix == 1 else f"{stem[:125]}_{subject[-6:]}_{suffix}"
        suffix += 1
    return candidate


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([GoogleRateThrottle])
@csrf_protect
def google_sign_in(request):
    if not settings.GOOGLE_OAUTH_CLIENT_ID:
        return Response({"detail": "Google sign-in is not configured on this server."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    serializer = GoogleCredentialSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        claims = id_token.verify_oauth2_token(
            serializer.validated_data["credential"],
            GoogleRequest(),
            audience=settings.GOOGLE_OAUTH_CLIENT_ID,
        )
    except (ValueError, GoogleAuthError):
        return Response({"detail": "Google could not verify this sign-in. Please try again."}, status=status.HTTP_401_UNAUTHORIZED)

    subject = claims.get("sub")
    email = (claims.get("email") or "").strip().lower()
    if not subject or not email or claims.get("email_verified") is not True:
        return Response({"detail": "Use a Google account with a verified email address."}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        identity = ExternalIdentity.objects.select_related("user").filter(provider="google", subject=subject).first()
        if identity:
            user = identity.user
            if user.email.lower() != email:
                user.email = email
                user.save(update_fields=("email",))
                identity.email = email
                identity.save(update_fields=("email",))
        else:
            if User.objects.filter(email__iexact=email).exists():
                return Response(
                    {"detail": "An account already uses this email. Sign in with its password first; account linking is not available yet."},
                    status=status.HTTP_409_CONFLICT,
                )
            user = User.objects.create_user(
                username=google_username(email, subject),
                email=email,
                password=None,
            )
            ExternalIdentity.objects.create(provider="google", subject=subject, user=user, email=email)

    login(request, user)
    return Response({"user": user_data(user)})


@api_view(["GET"])
def current_user(request):
    return Response({"user": user_data(request.user)})


@api_view(["POST"])
@csrf_protect
def sign_out(request):
    logout(request)
    return Response(status=status.HTTP_204_NO_CONTENT)
