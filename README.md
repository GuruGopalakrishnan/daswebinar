# webinar-clone

A webinar platform built with Next.js 16 (App Router), Supabase, Socket.IO and Agora.
The architecture follows the patterns observed in the webinar.gg analysis. All code here is
original.

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Project structure, Supabase auth (password + magic link), protected dashboard | **Done** |
| 2 | Webinar CRUD API (`/api/webinars`), schema + RLS, registration | **Done** (API only; dashboard UI pending) |
| 3 | Socket.IO server: public chat, presence, Q&A, polls, hand raise, reactions, settings | **Done** (server + client helper; no UI yet) |
| UI | Landing, dashboard, create/edit wizard, manage page, registration, live room, replay player | **Done** (needs migration 3) |
| 4 | Agora video: token minting, publish/subscribe, cloud recording | Planned |

## Pages

| Route | What it is |
|---|---|
| `/` | Marketing landing page: hero with an animated product preview, features, how it works, pricing, FAQ, CTA |
| `/login`, `/signup` | Split-screen auth |
| `/dashboard` | Stats, quick actions, a live-now banner and a filterable webinar list |
| `/dashboard/webinars/new`, `…/[id]/edit` | 5-step wizard: details → schedule (timezone-aware) → settings → registration questions → review |
| `/dashboard/webinars/[id]` | Manage page: overview, share link, registrations (approve/reject, search, CSV), recordings |
| `/register/[id]` | Public registration with a countdown, local time and custom fields; add-to-calendar on success |
| `/room/[id]` | Live room: stage, controls, chat / Q&A / polls / people, reactions, host settings, go live / end |
| `/recordings/[id]` | Replay player: keyboard shortcuts, speed, picture-in-picture, resume position |

Video in the room is **local only** for now. The host sees their real camera and screen-share
preview, and attendees see a status card. Broadcasting arrives with the video provider in
Phase 4.

## Setup

1. Create a Supabase project and apply the migrations:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
2. Copy `.env.example` to `.env.local` and fill in the Supabase URL and publishable key.
3. In Supabase → Authentication → URL Configuration, add
   `http://localhost:3000/auth/callback` to the redirect URLs.
4. `npm run dev` → http://localhost:3000

## Layout

```
src/
  proxy.ts                  Next 16 proxy (formerly middleware): refreshes the Supabase session
  lib/
    env.ts                  Typed env access
    auth.ts                 getCurrentUser / requireUser / safeNextPath
    supabase/
      client.ts             Browser client
      server.ts             Server Components / Server Functions / Route Handlers
      proxy.ts              Session refresh + coarse route guards
  app/
    (auth)/                 /login, /signup, shared form + server actions
    auth/callback/route.ts  Email-link landing (PKCE code or token_hash)
    dashboard/              Protected area
supabase/migrations/        SQL schema with RLS
```

Planned additions:

- `src/app/api/webinars/` holds the REST CRUD Route Handlers (phase 2).
- `src/app/api/agora/token/` mints server-side RTC tokens (phase 4). The app certificate
  never reaches the client.

## Webinar API

All endpoints take and return JSON. Bodies must be sent as `Content-Type: application/json`.
Errors look like `{ "error": { "code", "message", "details?" } }`. Auth uses the Supabase
session cookie.

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/api/webinars?status=&page=&limit=` | host | Your webinars, paginated |
| POST | `/api/webinars` | host | `title`, `startsAt` (ISO with offset) required. `status` is `draft` or `scheduled` |
| GET | `/api/webinars/:id` | anyone | The host gets the full record (`view: "host"`). Others get the public view, and drafts return 404 |
| PATCH | `/api/webinars/:id` | host | Partial update. `status` is limited to `draft`, `scheduled` or `cancelled` |
| DELETE | `/api/webinars/:id` | host | 204. Registrations are deleted along with it |
| POST | `/api/webinars/:id/register` | anyone | `email`, `fullName`. Idempotent. Returns `approved` or `pending` |
| GET | `/api/webinars/:id/registrations` | host | Attendee list, paginated |
| PATCH | `/api/webinars/:id/registrations/:rid` | host | `status`: `approved`, `rejected` or `cancelled` |

Requests from someone who isn't the host return 404 rather than 403, so they don't reveal that a
webinar exists. `live` and `ended` can't be set through the API: a database trigger blocks it,
and the Phase 4 lifecycle sets them.

**Known gaps (to address before production):** guest registrations aren't email-verified,
and there's no rate limiting. A script could fill a capped webinar with fake emails.

## Realtime server (`server/socket`)

A standalone Socket.IO process on port **3001**. Node 26 runs the TypeScript directly, with no build step.

```bash
npm run socket        # start (reads .env.local)
npm run socket:dev    # restart on file changes
npm run test:socket   # integration tests (stubbed auth, no Supabase needed)
```

Environment variables: `SOCKET_PORT` (default 3001) and `SOCKET_CORS_ORIGINS`, a comma-separated
list that defaults to `NEXT_PUBLIC_SITE_URL`. The client reads `NEXT_PUBLIC_SOCKET_URL`, which
defaults to `http://localhost:3001`.

**Auth.** The client sends its Supabase access token in the handshake, as `auth.token`. The server
verifies it against the project's JWKS (ES256) and checks issuer, audience `authenticated`,
expiry and `role=authenticated`. Anon/service keys and forged tokens are rejected. When the token
expires, the socket receives `connection:session_expired` and is disconnected. The client helper
pushes refreshed tokens via `connection:refresh_token` so long sessions stay up.

**Room access** goes through the database's RLS, using the user's own token. The host gets the
`host` role unless the webinar is cancelled. A signed-in user with an **approved** registration
gets `attendee` while the webinar is `scheduled` or `live`. Guest (no-account) registrants can't
join realtime.

**Events.** Every client→server event takes an ack callback that receives `{ ok, data | error }`.
The sender gets the ack; everyone else in the room gets the broadcast.

| Client → server | Who | Server → others |
|---|---|---|
| `connection:join_webinar {webinarId}` → snapshot | host, attendee | `user_session:live_count` |
| `public_chat:send_message {text, clientMessageId}` | all (host bypasses off/slow mode) | `public_chat:new_message` |
| `user_session:heartbeat {}` → `{liveCount}` | all, every 25s | — |
| `qna:submit_question {text}` | all | `qna:new_question` |
| `qna:upvote_question {questionId}` (toggle, not your own) | all | `qna:question_updated` |
| `poll:create_poll {question, options[2-6]}` | host | `poll:poll_created` |
| `poll:vote {pollId, optionId}` (re-voting changes your vote) | all | `poll:results` |
| `poll:close_poll {pollId}` | host | `poll:closed` |
| `handraise:raise_hand {}` / `handraise:lower_hand {userId?}` | attendee / self or host | `handraise:queue_updated` |
| `reaction:send_reaction {emoji}` (allowlist) | all | `reaction:reaction_received` |
| `webinar_settings:update_settings {…}` | host | `webinar_settings:settings_updated` |

All payloads are validated with strict zod schemas in `protocol.ts`, the file shared with the
browser client. Every event has per-user rate limits.

**Limitations (by design for now):** room state lives in memory. Chat, Q&A and polls are lost on
restart, and the server can't run as more than one instance without the Socket.IO Redis adapter
and shared storage. Empty rooms keep their state for 30 minutes.

## Auth notes

- Session refresh happens in `proxy.ts`, but **every protected page and Server Function
  calls `requireUser()` itself**. Proxy matchers alone are not an authorization boundary.
- Post-login redirects go through `safeNextPath()` to prevent open redirects.
- Login errors are generic, and magic-link requests don't reveal whether an account exists.
