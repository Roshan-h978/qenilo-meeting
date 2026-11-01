# QENILO implementation plan

Build and verify one phase at a time. Keep the current browser-only workspace usable until a matching server feature is ready to replace it.

## Phases

1. **Backend foundation** — Django, Django REST Framework, Channels/ASGI, environment-based settings, a health endpoint, and local run instructions. Status: complete; system check, migrations, and health response verified.
2. **Accounts and access** — account lifecycle, authentication, authorization, and API permissions. Status: complete; backend endpoints and React sign-in/registration screens are connected and checks pass.
3. **Meeting rooms** — create/join/leave APIs, room membership, participant presence, and shareable invitations. Status: complete; authenticated room APIs and invitation codes are implemented and covered by tests.
4. **Realtime signaling** — authenticated Channels WebSockets and WebRTC offer/answer/ICE exchange; Redis-backed channel layer for multi-process use. Status: complete; signaling is room-member restricted, payloads are bounded, and the Vite dev server proxies WebSockets.
5. **Live meeting interface** — connect the React device controls to room state, live participants, chat, and peer connections. Status: complete; the homepage can create or join rooms, and the meeting view connects peer media, presence, and live chat.
6. **Persistent meeting records** — store schedules, history, notes, decisions, and action items in PostgreSQL; add reminder delivery.
7. **Production readiness** — migrations, security configuration, automated checks, deployment setup, and operational documentation.

## Current focus

Phases 1 through 5 are complete. Next is Phase 6: persist meeting schedules, history, notes, decisions, and action items in the backend, then add reminder delivery. Keep Phase 7 production readiness out of scope until Phase 6 is complete.
