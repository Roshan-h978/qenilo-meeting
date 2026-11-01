from django.urls import path

from meetings.views import create_room, ice_server_config, join_room, leave_room, room_detail, room_heartbeat

urlpatterns = [
    path("ice-config/", ice_server_config, name="room-ice-config"),
    path("", create_room, name="room-create"),
    path("<str:code>/", room_detail, name="room-detail"),
    path("<str:code>/join/", join_room, name="room-join"),
    path("<str:code>/leave/", leave_room, name="room-leave"),
    path("<str:code>/heartbeat/", room_heartbeat, name="room-heartbeat"),
]
