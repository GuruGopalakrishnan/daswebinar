# Deploy & Grow Webinar (webinar platform)

A webinar platform built with Next.js 16 (App Router), Supabase (auth, Postgres, Realtime), Agora (live video)
and Razorpay (subscriptions). All code here is original. The brand name lives in `src/lib/brand.ts`.

## Pages

| Route | What it is |
|---|---|
| `/`, `/features`, `/how-it-works`, `/pricing` | Marketing pages (`src/app/(marketing)`): fully static, no auth lookup; animated SVG scenes run only while on screen. Unbuilt features are labelled "Coming soon" |
| `/login`, `/signup` | Auth. `/signup?plan=pro` sends the user to checkout right after they confirm their email. Login also offers an email sign-in link |
| `/verify-email` | "Check your inbox" with a resend button for accounts waiting on email confirmation |
| `/forgot-password`, `/reset-password` | Password reset. Expired or other-browser links land on `/forgot-password?error=link` |
| `/webinars/create`, `/billing`, `/billing/checkout`, `/recordings` | Aliases from the Deploy & Grow prototype (307 to the real routes, `next.config.ts`) |
| `/dashboard` | Stats, plan banner, webinar list |
| `/dashboard/webinars/new`, `…/[id]/edit` | 5-step wizard |
| `/dashboard/webinars/[id]` | Manage page: share link, registrations, recordings (by URL) |
| `/dashboard/billing` | Current plan, usage, Razorpay checkout, cancel |
| `/dashboard/recordings` | Local recordings saved in this browser: save to disk, recover after a crash |
| `/register/[id]` | Public registration page. Guests register and join without an account |
| `/join/[token]` | Personal join link: enter the room from any device without logging in |
| `/room/[id]` | Live room: pre-join check → studio (stage, dock, drawer, on-stage polls, spotlight, recording) |
| `/recordings/[id]` | Replay player |

## Plans

| | Free (₹0) | Pro (₹499/month) |
|---|---|---|
| Webinars | 1 per account | Unlimited |
| Attendees | 100 per webinar (pending + approved registrations) | Unlimited (or the host's own capacity) |

The limits are enforced **in the database** (`supabase/migrations/20261027000000_plans_billing.sql`), so every write path
is covered:

- a `before insert` trigger on `webinars` blocks a second webinar on the free plan (advisory lock, so parallel requests can't slip through)
- `start_webinar()` blocks running a second webinar. Webinars that went live are logged in `webinar_usage`, so deleting a finished webinar doesn't free a slot
- `register_for_webinar()` and a trigger on `registrations` cap attendees at `webinar_attendee_limit()`
- `user_plan()` is `pro` while the Razorpay subscription is authenticated/active/pending (or cancelled but paid up), plus one day of grace

The API returns `402 plan_webinar_limit` (create / go live) or `409 webinar_full` (register). Prices shown in the UI
come from `src/lib/billing/plans.ts`. The amount actually charged comes from the Razorpay plan. Both plans have every
feature; they differ only in limits, so never list a Free feature as a Pro extra.

**Upgrade flow (UI on top of the database rules):**

| Where | What the host sees |
|---|---|
| `/pricing` | Public plan comparison and FAQ. "Go Pro" → sign up → `/upgrade?checkout=1` |
| `/upgrade` | Usage, Free vs Pro table, and Razorpay checkout. Checkout appears only when `RAZORPAY_*` keys are set; otherwise an "opening soon" note, never a dead button |
| New webinar | A Free host at the limit sees an upgrade card instead of the wizard |
| Create / Go live | A `402` opens the upgrade modal (`src/components/billing/upgrade-dialog.tsx`) |
| Manage page | Notice from 80 of 100 seats; "Registration is closed" at 100. Shown only when the plan, not the host's own capacity, is the cap |
| Dashboard | Free plan card and "Upgrade" link to `/upgrade` |

Downgrade needs no job: `user_plan()` reads the subscription's period end on every check, so an expired or halted
subscription is Free on the next request. Existing webinars and registrations are kept; only new ones are capped.

## Payments (Razorpay Subscriptions)

1. The user clicks **Upgrade**. `POST /api/billing/subscribe` creates a subscription on `RAZORPAY_PLAN_ID` (with
   `notes.user_id`) and returns its id.
2. Razorpay Checkout opens (UPI, cards, net banking). On success, `POST /api/billing/verify` checks the HMAC signature,
   **reads the subscription back from Razorpay** (status and period are never taken from the browser), and upgrades the
   account.
3. `POST /api/billing/webhook` (signature-verified) keeps renewals, failed charges (`pending` → `halted`) and
   cancellations in sync. It is idempotent, and events for an older abandoned subscription are ignored.
4. `POST /api/billing/cancel` cancels at the end of the cycle, so Pro stays on until the paid period ends.

Writes to `subscriptions` use the service-role key (`src/lib/supabase/admin.ts`). Clients can only read their own row.

## Live room

```
PreJoin (device check)  →  Studio
                            ├─ Stage: screen share + draggable camera PiP / camera / avatar; spotlight caption; poll card; reactions
                            ├─ Top bar: title · LIVE timer · REC · reconnecting · network bars · viewer count  (auto-hides for attendees)
                            ├─ Dock: mic ˄ · video ˄ · present | volume · react · hand | chat · Q&A · polls · people | ••• | Go live / End / Leave
                            └─ Drawer: one panel at a time (right side on desktop, bottom sheet on mobile)
```

- **Video (Agora, `use-broadcast.ts`):** the host publishes camera + mic as uid 1 and their screen as uid 2 (a second
  connection, opened only while presenting), so attendees see slides and presenter together. Dual stream plus
  attendee fallback to the low stream on weak networks. Mute = unpublish. Automatic rejoin with backoff after
  disconnects and token expiry. Network quality is surfaced in the UI.
- **Realtime (Supabase):** chat, Q&A (answered state, on-stage spotlight), polls, hand raise, settings and attendee
  removal all go through `security definer` functions. Reactions are batched per sender (at most one message every 1.5 s).
- **Zoom research** and what was adopted: [`docs/zoom-research.md`](docs/zoom-research.md).

### Scale notes for 80–100+ attendees

- Agora live-broadcast mode handles thousands of audience members. Watch your Agora minutes.
- Supabase Realtime: the free plan allows 200 concurrent connections and has a message-rate quota. For regular
  100-person sessions use the **Pro plan**. Every chat message fans out to every attendee.

## Recording (local, on the host's computer)

**How it works** (`src/lib/recording/`, `src/components/room/use-recorder.ts`):

1. The host opens ••• → **Record to this computer** (or presses **R**). Everyone sees a **REC** badge.
2. The browser composites the program (screen share full-frame with the camera in a corner, or the camera, or a name
   card) onto a 1280×720 canvas at 24 fps. The host's mic is mixed in (silenced while muted), plus any shared tab audio.
3. `MediaRecorder` encodes it (MP4/H.264 where the browser supports it, otherwise WebM) and hands over a chunk every
   2 seconds. **Each chunk is written to IndexedDB immediately**, so memory stays flat for long sessions and a crash or
   closed tab loses at most about 2 seconds.
4. On **Stop** (or **End webinar**) the host picks where to save the file (Chrome/Edge save dialog; other browsers download it).

**Why it doesn't affect the live session:** it reads the same local streams the broadcast already uses, sends nothing over
the network, and never touches the live encoder. The draw loop runs on a Web Worker timer, so it keeps going when the host
switches to their slides app. Main-thread timers would be throttled there.

**Accessing recordings later:** the saved file is on the host's computer. **Dashboard → Recordings** also lists every
recording kept in that browser, including interrupted ones, with **Save file** and **Delete**. To give registrants a
replay, upload the file (YouTube unlisted, Drive, Vimeo) and add the link on the webinar's manage page.

**Limits:** the recording is on the device and browser that recorded it; use Chrome or Edge on a desktop. If you later
want recordings in the cloud with no host involvement, Agora Cloud Recording can write the mixed stream to S3-compatible
storage. It costs extra and needs a storage bucket.

## Setup

1. Apply the migrations: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
2. Copy `.env.example` to `.env.local` (and set the same variables in Vercel). In production,
   `NEXT_PUBLIC_SITE_URL` must be your live domain.
3. **Supabase → Authentication → URL Configuration** (this is what fixes "email link opens localhost"):
   - **Site URL**: `https://daswebinar.vercel.app` (your production domain)
   - **Redirect URLs**: `https://daswebinar.vercel.app/**` and `http://localhost:3000/**`. For Vercel preview
     deployments, also `https://*-<your-vercel-team>.vercel.app/**`.

   Every auth email asks Supabase to return to `<site>/auth/callback?next=…`. If that address doesn't match a
   Redirect URL, Supabase silently uses the Site URL instead (and drops the path), so a localhost Site URL sends
   production users to localhost. Use `/**` so the `?next=` part matches too.
4. Recommended: **Supabase → Authentication → Email Templates**, so links work even when opened on another device
   or browser than the one that asked for them:
   - **Confirm signup**: link to `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`
   - **Magic Link**: `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=magiclink`
   - **Reset Password**: `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery`

   Without this, links still work in the same browser. A signup link opened elsewhere confirms the email and asks
   the user to log in; a reset link opened elsewhere asks them to request a new one.
   **Also: Authentication → SMTP Settings.** Supabase's built-in sender allows only a few auth emails per hour, so
   in production sign-up and reset emails stop arriving. Use Resend: host `smtp.resend.com`, port `465`, username
   `resend`, password = your Resend API key, sender = an address on your verified domain.
5. **Supabase → Authentication → Sign In / Providers → Allow anonymous sign-ins: on.** This is what lets
   attendees join without creating an account (see "Guest join" below). Don't switch on **Attack Protection →
   CAPTCHA** yet: once it's on, every auth call (login, sign-up, guest) must send a captcha token, and the forms
   don't do that yet. It's on the checklist.
6. Razorpay: create the ₹499 monthly plan, add the API keys, plan id and webhook (see `.env.example`).
7. Agora: set `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE`.
8. `npm run dev` → http://localhost:3000

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
The prioritized list is in [`docs/implementation-checklist.md`](docs/implementation-checklist.md).

## Guest join

Attendees don't need an account (`supabase/migrations/20261028000000_guest_join.sql`):

1. On **Register**, a signed-out visitor gets a Supabase **anonymous session** (named after what they typed),
   then registers. The registration is tied to that `auth.uid()`, so `webinar_role()`, the channel policies
   and every room function work unchanged, and **Join** works straight away in that browser.
2. Every registration has a secret `join_token`. `/join/<token>` shows the webinar and, on a click (never on
   page load, so email link scanners can't use it up), signs the visitor in as a guest if needed and calls
   `claim_registration()`. The registrant sees the link after registering; the host can copy it per attendee.
3. Guest sessions can't host: a restrictive RLS policy blocks creating webinars, `requireUser()` /
   `requireApiUser()` reject them unless the page or endpoint opts in with `allowGuest` (room, replay, RTC
   token), and the proxy sends them from `/dashboard` to sign-up.
4. Linking rules: an account (verified email) takes over a registration held by a guest session. A guest who
   types an email only links to a registration that has no owner yet, because a typed email proves nothing.
   A join link moves a registration between guest sessions but never away from an account.

If anonymous sign-ins are off, registration still works as before; guests just can't join the room.

## Email notifications (Resend)

| Email | When | Sent from |
|---|---|---|
| Confirmation (+ `.ics` file) | Registration approved: right away, or when the host approves | register / approve API, via `after()` |
| 24 h reminder | 1–24 h before the start, to people who registered ≥ 22 h before | scheduled job |
| 1 h reminder | Within the hour before the start, to people who registered ≥ 90 min before | scheduled job |
| We're live | Host presses **Go live** (the job catches up for 30 min if that send failed) | start API, via `after()` |

Every email carries the attendee's **personal join link** (`/join/<token>`), so one click puts them in the room
with no login. Code: `src/lib/email/` (`resend.ts` client, `templates.ts`, `notify.ts`).

**Sent once, never twice.** `email_log` (migration `20261029000000_email_notifications.sql`) has one row per
(registration, kind). A sender claims rows first, sends only what it claimed, and releases them if Resend fails, so
the next run retries. Resend's `Idempotency-Key` covers retried requests. Emails never block or break registering or
going live; failures are logged.

**Setup**

1. Resend → **Domains**: add and verify your domain (DNS records). Then set `RESEND_API_KEY`,
   `EMAIL_FROM="Deploy & Grow Webinar <hello@yourdomain.com>"` and `SUPABASE_SERVICE_ROLE_KEY` (in Vercel too).
   Before the domain is verified, `onboarding@resend.dev` works but only delivers to your own Resend address.
2. Set `CRON_SECRET` to a long random string.
3. Call `/api/cron/emails` every 5 minutes. Vercel's free plan only runs crons once a day, so use Supabase
   (free) in the **SQL Editor**:

   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;
   select cron.schedule('webinar-emails', '*/5 * * * *', $$
     select net.http_post(
       url := 'https://yourdomain.com/api/cron/emails',
       headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>'),
       timeout_milliseconds := 60000
     );
   $$);
   ```

   Check runs with `select * from cron.job_run_details order by start_time desc limit 10;`, and stop with
   `select cron.unschedule('webinar-emails');`.
4. Test locally: `curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/emails` returns
   how many reminders went out.

## Realtime protocol details

The room runs entirely on the Supabase project, so there's no separate server to deploy. The schema,
functions and channel policies are in `supabase/migrations/20261026030000_realtime_room.sql`. The
client is `src/components/room/use-room.ts`, and the shared types are in `src/lib/realtime/protocol.ts`.

**Channels.** Both are private, so Realtime checks RLS policies on `realtime.messages` when you join.

| Topic | Who can receive | Who can send |
|---|---|---|
| `room:<webinarId>` | host, attendees | Broadcast: **the database only**. Presence: host, attendees |
| `room:<webinarId>:reactions` | host, attendees | host, attendees (client Broadcast) |

**Access** is decided by `webinar_role()`. The host gets `host` unless the webinar is cancelled. A
signed-in user (an account or a guest session, see "Guest join") with an **approved** registration gets
`attendee` while the webinar is `scheduled` or `live`.

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
