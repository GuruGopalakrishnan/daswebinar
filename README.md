# webinar-clone

A webinar platform built with Next.js 16 (App Router), Supabase (incl. Realtime) and Agora.
The architecture follows the patterns observed in the webinar.gg analysis. All code here is
original.

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Project structure, Supabase auth (password + magic link), protected dashboard | **Done** |
| 2 | Webinar CRUD API (`/api/webinars`), schema + RLS, registration | **Done** (API only; dashboard UI pending) |
| 3 | Realtime: public chat, presence, Q&A, polls, hand raise, reactions, settings | **Done** (Supabase Realtime; needs migration 4) |
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

## Live room (Supabase Realtime)

The room runs entirely on the Supabase project, so there's no separate server to deploy. The schema,
functions and channel policies are in `supabase/migrations/20261026030000_realtime_room.sql`. The
client is `src/components/room/use-room.ts`, and the shared types are in `src/lib/realtime/protocol.ts`.

**Channels.** Both are private, so Realtime checks RLS policies on `realtime.messages` when you join.

| Topic | Who can receive | Who can send |
|---|---|---|
| `room:<webinarId>` | host, attendees | Broadcast: **the database only**. Presence: host, attendees |
| `room:<webinarId>:reactions` | host, attendees | host, attendees (client Broadcast) |

**Access** is decided by `webinar_role()`. The host gets `host` unless the webinar is cancelled. A
signed-in user with an **approved** registration gets `attendee` while the webinar is `scheduled` or
`live`. Guest (no-account) registrants can't join.

**Writes go through the database.** Chat, Q&A, polls and settings are `security definer` functions,
called with `supabase.rpc`. Each one checks access, room settings (chat/Q&A off, slow mode) and rate
limits. It then stores the row, so people who join late get the history, and broadcasts the result with
`realtime.send()`. Clients can't broadcast on the room topic, so they can't fake these events. Errors
come back as `message = code` (e.g. `slow_mode`) and `details` = text to show the user.

| Function | Who | Broadcast on `room:<id>` |
|---|---|---|
| `get_room_snapshot(webinar)` → settings, last 200 messages, questions, polls | host, attendee | — |
| `send_room_message(webinar, text, clientMessageId)`: idempotent, 5 per 10s | all (host bypasses off/slow mode) | `public_chat:new_message` |
| `ask_question(webinar, text)`: 3 per 30s | all | `qna:new_question` |
| `toggle_question_upvote(question)`: not your own | all | `qna:question_updated` |
| `create_poll(webinar, question, options[2-6])` | host | `poll:poll_created` |
| `vote_poll(poll, option)`: voting again changes your vote | all | `poll:results` |
| `close_poll(poll)` | host | `poll:closed` |
| `update_room_settings(webinar, {…})`: saved on the webinar | host | `webinar_settings:settings_updated` |
| `lower_room_hand(webinar, user)` | host | `handraise:lower_hand` |
| `start_webinar` / `end_webinar` (trigger) | host | `webinar:status_changed` |

**Presence** on the room topic, with the user ID as key so several tabs count once, gives the live count, the
roster and the hand-raise queue. Each client tracks `{ userId, name, handRaisedAt }`. Realtime's own
heartbeat drops clients that disappear. Roles in the roster come from the snapshot's `hostId`, not from
the presence payload.

**Reactions** are client Broadcasts on the `:reactions` topic. They're throttled on the sender and
ignored by receivers while reactions are off (except the host's).

**Reconnects.** Broadcasts aren't replayed, so the client fetches the snapshot again on every
`SUBSCRIBED` and tracks Presence again. supabase-js passes refreshed access tokens to Realtime.

**Limitations.** Votes, upvotes and reactions have no server-side rate limit. Presence names and hand
raises come from the client, so a modified client could show a wrong display name or lower its own hand
late. Access is checked when a channel is joined, so someone whose registration is revoked keeps receiving
until they reconnect. They can't write, because every function checks access again.

## Auth notes

- Session refresh happens in `proxy.ts`, but **every protected page and Server Function
  calls `requireUser()` itself**. Proxy matchers alone are not an authorization boundary.
- Post-login redirects go through `safeNextPath()` to prevent open redirects.
- Login errors are generic, and magic-link requests don't reveal whether an account exists.
