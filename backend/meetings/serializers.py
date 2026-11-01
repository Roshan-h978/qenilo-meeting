from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from meetings.models import MeetingRoom, RoomMembership

PRESENCE_WINDOW_SECONDS = 90


def participant_data(membership, now=None):
    now = now or timezone.now()
    is_present = membership.left_at is None and membership.last_seen >= now - timedelta(seconds=PRESENCE_WINDOW_SECONDS)
    return {
        "userId": membership.user_id,
        "username": membership.user.username,
        "isHost": membership.user_id == membership.room.host_id,
        "isPresent": is_present,
        "joinedAt": membership.joined_at,
        "lastSeen": membership.last_seen,
    }


class RoomCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=100, trim_whitespace=True)


def room_data(room, include_participants=True):
    now = timezone.now()
    members = room.memberships.select_related("user", "room").filter(left_at__isnull=True)
    participants = [participant_data(member, now) for member in members] if include_participants else []
    return {
        "id": str(room.id),
        "code": room.code,
        "title": room.title,
        "host": {"id": room.host_id, "username": room.host.username},
        "isActive": room.is_active,
        "createdAt": room.created_at,
        "participants": participants,
        "participantCount": sum(person["isPresent"] for person in participants),
    }
