import json
import base64
import hashlib
import hmac

from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import Client, TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from unittest.mock import patch

from config.asgi import application
from meetings.models import MeetingRoom, RoomMembership

User = get_user_model()


class MeetingRoomApiTests(TestCase):
    def setUp(self):
        self.host = User.objects.create_user(username="host", password="host-test-password")
        self.guest = User.objects.create_user(username="guest", password="guest-test-password")
        self.host_client = Client(enforce_csrf_checks=True)
        self.host_client.force_login(self.host)
        self.host_csrf = self.host_client.get("/api/auth/csrf/").json()["csrfToken"]

    @staticmethod
    def post(client, path, data, csrf):
        return client.post(
            path,
            data=json.dumps(data),
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf,
        )

    def create_room(self):
        return self.post(self.host_client, "/api/rooms/", {"title": "Project kickoff"}, self.host_csrf)

    def test_create_room_generates_invite_code_and_host_membership(self):
        response = self.create_room()

        self.assertEqual(response.status_code, 201)
        room = MeetingRoom.objects.get(code=response.json()["code"])
        self.assertEqual(room.title, "Project kickoff")
        self.assertEqual(room.host, self.host)
        self.assertTrue(RoomMembership.objects.filter(room=room, user=self.host, left_at__isnull=True).exists())
        self.assertEqual(response.json()["participantCount"], 1)
        self.assertEqual(len(room.code), 12)

    def test_invited_user_can_join_heartbeat_and_leave(self):
        room_response = self.create_room()
        room_code = room_response.json()["code"]
        guest_client = Client(enforce_csrf_checks=True)
        guest_client.force_login(self.guest)
        guest_csrf = guest_client.get("/api/auth/csrf/").json()["csrfToken"]

        joined = self.post(guest_client, f"/api/rooms/{room_code.lower()}/join/", {}, guest_csrf)
        self.assertEqual(joined.status_code, 200)
        self.assertEqual(joined.json()["participantCount"], 2)
        self.assertTrue(any(person["username"] == "guest" and person["isPresent"] for person in joined.json()["participants"]))

        heartbeat = self.post(guest_client, f"/api/rooms/{room_code}/heartbeat/", {}, guest_csrf)
        self.assertEqual(heartbeat.status_code, 200)
        left = self.post(guest_client, f"/api/rooms/{room_code}/leave/", {}, guest_csrf)
        self.assertEqual(left.status_code, 200)
        self.assertEqual(self.host_client.get(f"/api/rooms/{room_code}/").json()["participantCount"], 1)
        self.assertEqual(guest_client.get(f"/api/rooms/{room_code}/").status_code, 403)

    def test_room_endpoints_require_authentication_and_csrf(self):
        room = MeetingRoom.objects.create(title="Private room", host=self.host)
        anonymous = Client()
        self.assertEqual(anonymous.get(f"/api/rooms/{room.code}/").status_code, 403)

        response = self.host_client.post(
            "/api/rooms/",
            data=json.dumps({"title": "No CSRF"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    def test_joining_a_room_twice_does_not_duplicate_membership(self):
        room_code = self.create_room().json()["code"]
        guest_client = Client()
        guest_client.force_login(self.guest)

        self.assertEqual(guest_client.post(f"/api/rooms/{room_code}/join/").status_code, 200)
        self.assertEqual(guest_client.post(f"/api/rooms/{room_code}/join/").status_code, 200)
        self.assertEqual(RoomMembership.objects.filter(room__code=room_code, user=self.guest).count(), 1)

    @override_settings(
        STUN_SERVER_URLS=["stun:stun.test:3478"],
        TURN_URLS=["turn:relay.test:3478?transport=udp"],
        TURN_SHARED_SECRET="test-turn-secret",
        TURN_CREDENTIAL_TTL_SECONDS=600,
        CLOUDFLARE_TURN_KEY_ID="",
        CLOUDFLARE_TURN_API_TOKEN="",
    )
    def test_ice_config_issues_short_lived_turn_credentials(self):
        response = self.host_client.get("/api/rooms/ice-config/")

        self.assertEqual(response.status_code, 200)
        config = response.json()
        self.assertTrue(config["turnEnabled"])
        self.assertEqual(config["iceServers"][0]["urls"], ["stun:stun.test:3478"])
        turn = config["iceServers"][1]
        expected_credential = base64.b64encode(hmac.new(
            b"test-turn-secret",
            turn["username"].encode(),
            hashlib.sha1,
        ).digest()).decode()
        self.assertEqual(turn["credential"], expected_credential)
        self.assertEqual(turn["username"].split(":", 1)[1], str(self.host.pk))
        self.assertGreater(config["credentialExpiresAt"], timezone.now().timestamp())
        self.assertIn("no-store", response["Cache-Control"])

    @override_settings(TURN_URLS=[], TURN_SHARED_SECRET="", CLOUDFLARE_TURN_KEY_ID="", CLOUDFLARE_TURN_API_TOKEN="")
    def test_ice_config_works_without_turn_and_returns_stun_fallback(self):
        response = self.host_client.get("/api/rooms/ice-config/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["turnEnabled"])
        self.assertIsNone(response.json()["credentialExpiresAt"])

    @override_settings(
        TURN_URLS=[],
        TURN_SHARED_SECRET="",
        TURN_CREDENTIAL_TTL_SECONDS=600,
        CLOUDFLARE_TURN_KEY_ID="test-key-id",
        CLOUDFLARE_TURN_API_TOKEN="test-api-token",
    )
    @patch("meetings.views.urlopen")
    def test_ice_config_requests_short_lived_cloudflare_relay_credentials(self, mock_urlopen):
        mock_urlopen.return_value.__enter__.return_value.read.return_value = json.dumps({
            "iceServers": [
                {"urls": ["stun:stun.cloudflare.com:3478"]},
                {"urls": ["turn:turn.cloudflare.com:3478?transport=udp"], "username": "temporary-user", "credential": "temporary-password"},
            ],
        }).encode()

        response = self.host_client.get("/api/rooms/ice-config/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["turnEnabled"])
        self.assertEqual(response.json()["turnProvider"], "cloudflare")
        self.assertEqual(response.json()["iceServers"][1]["username"], "temporary-user")
        self.assertGreater(response.json()["credentialExpiresAt"], timezone.now().timestamp())
        api_request = mock_urlopen.call_args.args[0]
        self.assertEqual(api_request.get_header("Authorization"), "Bearer test-api-token")
        self.assertEqual(json.loads(api_request.data), {"ttl": 600})


class RoomSignalingTests(TransactionTestCase):
    def setUp(self):
        self.host = User.objects.create_user(username="signal-host", password="host-password")
        self.guest = User.objects.create_user(username="signal-guest", password="guest-password")
        self.room = MeetingRoom.objects.create(title="Signaling room", host=self.host)
        now = timezone.now()
        RoomMembership.objects.create(room=self.room, user=self.host, joined_at=now, last_seen=now)
        RoomMembership.objects.create(room=self.room, user=self.guest, joined_at=now, last_seen=now)

    @staticmethod
    def session_headers(user):
        client = Client()
        client.force_login(user)
        session_cookie = client.cookies[settings.SESSION_COOKIE_NAME].value
        return [
            (b"origin", b"http://localhost:5174"),
            (b"cookie", f"{settings.SESSION_COOKIE_NAME}={session_cookie}".encode()),
        ]

    def test_authenticated_room_members_can_exchange_webrtc_signals(self):
        host_headers = self.session_headers(self.host)
        guest_headers = self.session_headers(self.guest)

        async def exercise_signaling():
            host = WebsocketCommunicator(
                application,
                f"/ws/rooms/{self.room.code}/",
                headers=host_headers,
            )
            guest = WebsocketCommunicator(
                application,
                f"/ws/rooms/{self.room.code}/",
                headers=guest_headers,
            )
            try:
                host_connected, _ = await host.connect()
                self.assertTrue(host_connected)
                self.assertEqual((await host.receive_json_from())["type"], "ready")

                guest_connected, _ = await guest.connect()
                self.assertTrue(guest_connected)
                guest_ready = await guest.receive_json_from()
                self.assertEqual(guest_ready["type"], "ready")
                self.assertTrue(any(person["userId"] == self.host.pk for person in guest_ready["participants"]))
                joined = await host.receive_json_from()
                self.assertEqual(joined, {"type": "peer_joined", "userId": self.guest.pk, "username": self.guest.username})

                await guest.send_json_to({"type": "heartbeat"})
                self.assertEqual(await guest.receive_json_from(), {"type": "heartbeat_ack"})

                await host.send_json_to({"type": "chat", "text": "Hello from the host"})
                host_message = await host.receive_json_from()
                guest_message = await guest.receive_json_from()
                self.assertEqual(host_message["type"], "chat_message")
                self.assertEqual(guest_message["text"], "Hello from the host")
                self.assertEqual(guest_message["userId"], self.host.pk)

                offer = {"sdp": "v=0\r\n", "type": "offer"}
                await host.send_json_to({"type": "offer", "targetUserId": self.guest.pk, "payload": offer})
                received_offer = await guest.receive_json_from()
                self.assertEqual(received_offer, {"type": "offer", "fromUserId": self.host.pk, "payload": offer})

                answer = {"sdp": "v=0\r\n", "type": "answer"}
                await guest.send_json_to({"type": "answer", "targetUserId": self.host.pk, "payload": answer})
                received_answer = await host.receive_json_from()
                self.assertEqual(received_answer, {"type": "answer", "fromUserId": self.guest.pk, "payload": answer})

                await host.send_json_to({"type": "ice_candidate", "targetUserId": 99999, "payload": {"candidate": "candidate"}})
                error = await host.receive_json_from()
                self.assertEqual(error["type"], "error")

                await guest.disconnect()
                left = await host.receive_json_from()
                self.assertEqual(left, {"type": "peer_disconnected", "userId": self.guest.pk, "username": self.guest.username})
            finally:
                await host.disconnect()

        async_to_sync(exercise_signaling)()

    def test_websocket_rejects_anonymous_and_nonmember_users(self):
        outsider = User.objects.create_user(username="outsider", password="outsider-password")
        outsider_headers = self.session_headers(outsider)

        async def exercise_access():
            anonymous = WebsocketCommunicator(application, f"/ws/rooms/{self.room.code}/", headers=[(b"origin", b"http://localhost:5174")])
            connected, _ = await anonymous.connect()
            self.assertFalse(connected)

            nonmember = WebsocketCommunicator(
                application,
                f"/ws/rooms/{self.room.code}/",
                headers=outsider_headers,
            )
            connected, _ = await nonmember.connect()
            self.assertFalse(connected)

        async_to_sync(exercise_access)()
