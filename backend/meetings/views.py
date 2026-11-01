import base64
import hashlib
import hmac
import json
import time
from urllib.request import Request, urlopen

from django.conf import settings
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from django.views.decorators.cache import never_cache
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from meetings.models import MeetingRoom, RoomMembership
from meetings.serializers import RoomCreateSerializer, room_data


@never_cache
@api_view(["GET"])
def ice_server_config(request):
    ice_servers = []
    if settings.STUN_SERVER_URLS:
        ice_servers.append({"urls": settings.STUN_SERVER_URLS})

    cloudflare_enabled = bool(settings.CLOUDFLARE_TURN_KEY_ID and settings.CLOUDFLARE_TURN_API_TOKEN)
    coturn_enabled = bool(settings.TURN_URLS and settings.TURN_SHARED_SECRET)
    turn_enabled = False
    expires_at = None
    turn_provider = None
    if cloudflare_enabled:
        payload = json.dumps({"ttl": settings.TURN_CREDENTIAL_TTL_SECONDS}).encode("utf-8")
        api_request = Request(
            f"https://rtc.live.cloudflare.com/v1/turn/keys/{settings.CLOUDFLARE_TURN_KEY_ID}/credentials/generate-ice-servers",
            data=payload,
            headers={
                "Authorization": f"Bearer {settings.CLOUDFLARE_TURN_API_TOKEN}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urlopen(api_request, timeout=5) as api_response:
                turn_config = json.loads(api_response.read().decode("utf-8"))
            turn_servers = turn_config.get("iceServers", [])
            if isinstance(turn_servers, list) and turn_servers:
                ice_servers = turn_servers
                turn_enabled = True
                turn_provider = "cloudflare"
                expires_at = int(time.time()) + settings.TURN_CREDENTIAL_TTL_SECONDS
        except (OSError, ValueError, json.JSONDecodeError):
            # Keep the meeting usable through STUN if the managed relay is temporarily unavailable.
            pass
    elif coturn_enabled:
        expires_at = int(time.time()) + settings.TURN_CREDENTIAL_TTL_SECONDS
        username = f"{expires_at}:{request.user.pk}"
        digest = hmac.new(
            settings.TURN_SHARED_SECRET.encode("utf-8"),
            username.encode("utf-8"),
            hashlib.sha1,
        ).digest()
        credential = base64.b64encode(digest).decode("ascii")
        ice_servers.append({"urls": settings.TURN_URLS, "username": username, "credential": credential})
        turn_enabled = True
        turn_provider = "coturn"

    return Response({
        "iceServers": ice_servers,
        "turnEnabled": turn_enabled,
        "turnProvider": turn_provider,
        "credentialExpiresAt": expires_at,
    })


def require_membership(room, user):
    membership = RoomMembership.objects.filter(room=room, user=user, left_at__isnull=True).first()
    if membership is None:
        raise PermissionDenied("Join this room before viewing or updating it.")
    return membership


@transaction.atomic
@api_view(["POST"])
def create_room(request):
    serializer = RoomCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    now = timezone.now()
    room = MeetingRoom.objects.create(title=serializer.validated_data["title"], host=request.user)
    RoomMembership.objects.create(room=room, user=request.user, joined_at=now, last_seen=now)
    return Response(room_data(room), status=status.HTTP_201_CREATED)


@api_view(["GET"])
def room_detail(request, code):
    room = get_object_or_404(MeetingRoom, code=code.upper())
    require_membership(room, request.user)
    return Response(room_data(room))


@api_view(["POST"])
def join_room(request, code):
    room = get_object_or_404(MeetingRoom, code=code.upper())
    if not room.is_active:
        return Response({"detail": "This meeting is no longer active."}, status=status.HTTP_410_GONE)
    now = timezone.now()
    membership, _ = RoomMembership.objects.get_or_create(
        room=room,
        user=request.user,
        defaults={"joined_at": now, "last_seen": now},
    )
    if membership.left_at is not None:
        membership.joined_at = now
        membership.left_at = None
    membership.last_seen = now
    membership.save(update_fields=("joined_at", "left_at", "last_seen"))
    return Response(room_data(room), status=status.HTTP_200_OK)


@api_view(["POST"])
def leave_room(request, code):
    room = get_object_or_404(MeetingRoom, code=code.upper())
    membership = require_membership(room, request.user)
    now = timezone.now()
    membership.left_at = now
    membership.save(update_fields=("left_at",))
    return Response({"roomCode": room.code, "leftAt": now})


@api_view(["POST"])
def room_heartbeat(request, code):
    room = get_object_or_404(MeetingRoom, code=code.upper())
    membership = require_membership(room, request.user)
    membership.last_seen = timezone.now()
    membership.save(update_fields=("last_seen",))
    return Response({"roomCode": room.code, "lastSeen": membership.last_seen})
