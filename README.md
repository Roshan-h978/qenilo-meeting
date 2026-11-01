# QENILO Meeting Workspace

A React and Vite workspace for preparing meeting notes, capturing decisions and action items, and managing local meeting schedules.

## Run locally

1. Install Node.js (LTS).
2. In this folder, run `npm install`.
3. Start the backend as described below, then run `npm run dev` and open `http://localhost:5174`. QENILO uses port 5174 to avoid clashing with another local app on port 5173. Vite forwards `/api` requests to `http://127.0.0.1:8000`.

## Run the backend foundation

In a second terminal, from the `backend` folder:

1. Create a virtual environment with `python -m venv .venv`.
2. Activate it with `.\.venv\Scripts\Activate.ps1` on Windows.
3. Install dependencies with `pip install -r requirements.txt`.
4. Copy `.env.example` to `.env`.
5. Run `python manage.py migrate`, then `python manage.py runserver`.

The backend uses SQLite and an in-memory Channels layer for local development. Its health endpoint is `http://127.0.0.1:8000/api/health/`. PostgreSQL and Redis are configured through `DATABASE_URL` and `REDIS_URL` for deployment.

Account endpoints are available at `/api/auth/csrf/`, `/api/auth/register/`, `/api/auth/login/`, `/api/auth/logout/`, and `/api/auth/me/`. The React interface provides separate sign-in and registration pages and checks the current Django session on startup. Account actions use Django session cookies and CSRF protection. Meeting schedules, history, settings, and outcomes remain browser-local and are not synced to accounts.

The sign-in page also supports Google Identity Services. To enable it, create a Google OAuth web client, add the local frontend origins (`http://localhost:5174` and `http://127.0.0.1:5174`) as authorized JavaScript origins, and put the same client ID in `.env.local` as `VITE_GOOGLE_CLIENT_ID` and in `backend/.env` as `GOOGLE_OAUTH_CLIENT_ID`. Restart both servers after setting the values. The client ID is public configuration; never put a client secret in the frontend. Google login verifies the ID token on the server and requires a verified email. If that email already belongs to a password account, the app asks the user to sign in with the password; automatic account linking is not enabled.

Authenticated meeting room endpoints are available at `POST /api/rooms/` (create), `GET /api/rooms/{code}/` (view room and participants), `POST /api/rooms/{code}/join/`, `POST /api/rooms/{code}/leave/`, and `POST /api/rooms/{code}/heartbeat/`. Room codes are shareable invitation codes. Presence expires after 90 seconds without a heartbeat. These endpoints provide room membership and presence data; they do not yet connect participants' audio or video.

Authenticated room signaling is available at `ws/rooms/{code}/` through the Vite `/ws` WebSocket proxy. Only active room members can connect. A connection receives a `ready` message with current participants, then `peer_joined` and `peer_disconnected` events. Clients exchange targeted `offer`, `answer`, and `ice_candidate` messages; room chat and heartbeat presence use the same connection. Signal payloads are limited to 64 KB. The app fetches ICE server configuration from `/api/rooms/ice-config/`, retries signaling after network drops, and restarts ICE after a peer connection degrades.

For local testing without a provider account, Metered documents a public static-auth Open Relay endpoint. It advertises 20 GB of free TURN usage monthly, but its static credentials are shared, so reliability and availability are outside this project's control; use project-specific credentials or a managed/server-owned relay for production. The example is in `backend/.env.example`. For a self-hosted coturn relay, set `TURN_URLS` and `TURN_SHARED_SECRET`. Or create a Cloudflare Realtime TURN key and a narrowly scoped API token, then set `CLOUDFLARE_TURN_KEY_ID` and `CLOUDFLARE_TURN_API_TOKEN`; the backend requests short-lived ICE credentials and never sends the API token to browsers. Keep all relay secrets in the backend and restart Django after changes. Cloudflare lists TURN at $0.05 per real-time GB of outbound data, with the first 1,000 GB monthly free; check its current [TURN pricing](https://developers.cloudflare.com/realtime/turn/faq/) before enabling. Without relay credentials, the app uses public STUN servers and some networks may still block media.

## Available features

- Create a titled meeting workspace.
- Start an instant meeting, create its room on the Django backend, and copy its invitation code.
- Join an existing room by entering its invitation code.
- Exchange participant audio/video, list room participants, and send live in-room chat when peers connect.
- Preview your camera and control local microphone/camera tracks with browser permission.
- Preview a screen share locally with browser permission.
- Capture notes, decisions, and action items with optional owners; copy the outcome summary.
- Save meeting workspaces and outcomes in Recent Meetings.
- Schedule meetings in a browser-local calendar.
- Set a display name and default microphone/camera preferences.

## Source layout

- `src/App.jsx` selects the active page and connects its data and actions.
- `src/hooks/` contains the meeting session, calendar, preferences, and notification logic.
- `src/pages/` contains the account, home, calendar, recent meetings, settings, and meeting workspace screens.
- `src/components/` contains shared account layout, controls, and the meeting outcomes board.
- `src/App.css` contains the interface styles.
- `backend/` contains the Django API and ASGI/Channels foundation.
- `IMPLEMENTATION_PLAN.md` tracks the staged backend and live-meeting work.

## Current limits

Meeting rooms connect browser peers using WebRTC through authenticated Django Channels signaling. The interface supports room codes, live participant presence, peer audio/video, screen share tracks, and live chat. Connectivity falls back across two public STUN servers and supports an optional TURN relay with short-lived credentials, automatic ICE recovery, and signaling reconnection. A TURN server must be provisioned and configured for relay connectivity on restrictive networks. Chat is live only and is not saved. Schedules, meeting history, settings, and outcomes remain browser-local; reminders are not sent. Production multi-process signaling requires `REDIS_URL` to point to a running Redis service.

The planned production architecture is React with Django REST Framework, Django Channels, WebRTC or a media server such as LiveKit, and PostgreSQL.
