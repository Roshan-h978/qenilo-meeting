from django.urls import path

from meetings.consumers import RoomSignalingConsumer

websocket_urlpatterns = [
    path("ws/rooms/<str:code>/", RoomSignalingConsumer.as_asgi(), name="room-signaling"),
]
