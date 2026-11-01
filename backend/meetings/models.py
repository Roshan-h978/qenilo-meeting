import secrets
import string
import uuid

from django.conf import settings
from django.db import models


def generate_room_code():
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(12))


class MeetingRoom(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=12, unique=True, default=generate_room_code)
    title = models.CharField(max_length=100)
    host = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="hosted_meeting_rooms")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.code})"


class RoomMembership(models.Model):
    room = models.ForeignKey(MeetingRoom, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="meeting_room_memberships")
    joined_at = models.DateTimeField()
    last_seen = models.DateTimeField()
    left_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("room", "user"), name="unique_room_membership")]
        ordering = ("joined_at", "id")
