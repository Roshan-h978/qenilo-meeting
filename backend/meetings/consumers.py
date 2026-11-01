import json
import time
from datetime import timedelta

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.core.cache import cache
from django.utils import timezone

from meetings.models import MeetingRoom, RoomMembership

SIGNAL_TYPES = {"offer", "answer", "ice_candidate"}
MAX_SIGNAL_BYTES = 64 * 1024
MESSAGE_WINDOW_SECONDS = 10
MAX_ROOM_MESSAGES_PER_WINDOW = 20
MAX_SIGNAL_MESSAGES_PER_WINDOW = 60
MAX_HEARTBEATS_PER_WINDOW = 10
MESSAGE_RATE_WINDOW_SECONDS = 10


class RoomSignalingConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return

        membership = await self.get_active_membership(self.scope["url_route"]["kwargs"]["code"], user.pk)
        if membership is None:
            await self.close(code=4403)
            return

        self.user_id = user.pk
        self.username = user.username
        self.room_id = membership["id"]
        self.room_code = membership["code"]
        self.room_group_name = f"room_{self.room_id.hex}"
        self.user_group_name = f"user_{self.user_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.channel_layer.group_add(self.user_group_name, self.channel_name)
        await self.accept()
        await self.send_json({
            "type": "ready",
            "roomCode": self.room_code,
            "userId": self.user_id,
            "participants": [person for person in membership["participants"] if person["userId"] != self.user_id],
        })
        await self.channel_layer.group_send(self.room_group_name, {
            "type": "room.event",
            "event": {"type": "peer_joined", "userId": self.user_id, "username": self.username},
        })

    async def disconnect(self, close_code):
        room_group = getattr(self, "room_group_name", None)
        user_group = getattr(self, "user_group_name", None)
        if room_group:
            await self.channel_layer.group_send(room_group, {
                "type": "room.event",
                "event": {"type": "peer_disconnected", "userId": self.user_id, "username": self.username},
            })
            await self.channel_layer.group_discard(room_group, self.channel_name)
        if user_group:
            await self.channel_layer.group_discard(user_group, self.channel_name)

    async def receive_json(self, content, **kwargs):
        if not isinstance(content, dict):
            await self.send_error("Send a JSON object with a signaling type, recipient, and payload.")
            return

        signal_type = content.get("type")
        if signal_type == "heartbeat":
            if not await self.allow_message("heartbeat", MAX_HEARTBEATS_PER_WINDOW):
                await self.send_error("Too many presence updates. Please wait a moment.")
                return
            await self.touch_membership()
            await self.send_json({"type": "heartbeat_ack"})
            return

        if signal_type == "chat":
            if not await self.allow_message("chat", MAX_ROOM_MESSAGES_PER_WINDOW):
                await self.send_error("You are sending messages too quickly. Please wait a moment.")
                return
            text = content.get("text")
            if not isinstance(text, str) or not text.strip() or len(text.strip()) > 1000:
                await self.send_error("Chat messages must contain 1 to 1000 characters.")
                return
            await self.channel_layer.group_send(self.room_group_name, {
                "type": "room.event",
                "event": {
                    "type": "chat_message",
                    "userId": self.user_id,
                    "username": self.username,
                    "text": text.strip(),
                    "sentAt": timezone.now().isoformat(),
                },
            })
            return

        target_user_id = content.get("targetUserId")
        payload = content.get("payload")
        if signal_type not in SIGNAL_TYPES:
            await self.send_error("Supported signaling types are offer, answer, and ice_candidate.")
            return
        if not await self.allow_message("signal", MAX_SIGNAL_MESSAGES_PER_WINDOW):
            await self.send_error("Too many connection updates. Please wait a moment.")
            return
        if not isinstance(target_user_id, int) or isinstance(target_user_id, bool) or target_user_id == self.user_id:
            await self.send_error("Choose another active room participant as the recipient.")
            return
        if not isinstance(payload, dict):
            await self.send_error("The signaling payload must be a JSON object.")
            return
        try:
            payload_size = len(json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
        except (TypeError, ValueError, RecursionError):
            await self.send_error("The signaling payload is not valid JSON data.")
            return
        if payload_size > MAX_SIGNAL_BYTES:
            await self.send_error("The signaling payload is too large.")
            return
        if not await self.is_active_member(target_user_id):
            await self.send_error("That user is not an active member of this room.")
            return

        await self.channel_layer.group_send(f"user_{target_user_id}", {
            "type": "signal.message",
            "room_id": self.room_id.hex,
            "target_user_id": target_user_id,
            "sender_user_id": self.user_id,
            "signal_type": signal_type,
            "payload": payload,
        })

    async def room_event(self, event):
        if event["event"].get("type") in {"peer_joined", "peer_disconnected"} and event["event"].get("userId") == self.user_id:
            return
        await self.send_json(event["event"])

    async def signal_message(self, event):
        if event["room_id"] != self.room_id.hex or event["target_user_id"] != self.user_id:
            return
        await self.send_json({
            "type": event["signal_type"],
            "fromUserId": event["sender_user_id"],
            "payload": event["payload"],
        })

    async def send_error(self, detail):
        await self.send_json({"type": "error", "detail": detail})

    @database_sync_to_async
    def allow_message(self, category, limit):
        window = int(time.time() // MESSAGE_RATE_WINDOW_SECONDS)
        key = f"room-rate:{self.room_id.hex}:{self.user_id}:{category}:{window}"
        if cache.add(key, 1, timeout=MESSAGE_RATE_WINDOW_SECONDS + 1):
            return True
        return cache.incr(key) <= limit

    @database_sync_to_async
    def get_active_membership(self, code, user_id):
        membership = RoomMembership.objects.select_related("room").filter(
            room__code=code.upper(), room__is_active=True, user_id=user_id, left_at__isnull=True,
        ).first()
        if membership is None:
            return None
        membership.last_seen = timezone.now()
        membership.save(update_fields=("last_seen",))
        active_since = timezone.now() - timedelta(seconds=90)
        participants = membership.room.memberships.select_related("user").filter(
            left_at__isnull=True,
            last_seen__gte=active_since,
        )
        return {
            "id": membership.room_id,
            "code": membership.room.code,
            "participants": [
                {"userId": person.user_id, "username": person.user.username, "isHost": person.user_id == membership.room.host_id}
                for person in participants
            ],
        }

    @database_sync_to_async
    def is_active_member(self, user_id):
        return RoomMembership.objects.filter(
            room_id=self.room_id, user_id=user_id, left_at__isnull=True, room__is_active=True,
        ).exists()

    @database_sync_to_async
    def touch_membership(self):
        RoomMembership.objects.filter(
            room_id=self.room_id, user_id=self.user_id, left_at__isnull=True, room__is_active=True,
        ).update(last_seen=timezone.now())
