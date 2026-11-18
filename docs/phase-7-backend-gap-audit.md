# Phase 7 backend gap audit

Audit date: 2026-11-18. Branch: `feature/deploy-grow-ui-integration` at `9569d5b`. **Status: proposal for review. No
Phase 7 code has been written.**

Scope: the code in this repository (migrations, API routes, `src/lib/*`, room hooks, scripts). I did not connect to
any Supabase, Razorpay, Agora or Resend account, ran no migrations and read no secrets. Anything that depends on those
services is therefore at best "implemented, needs real integration testing".

## How to read the classifications

| Code | Meaning |
|---|---|
| **V** | Implemented and verified by an automated test that actually ran. Today that is only `npm run test:db`: PGlite, real Postgres 16, with stand-ins for Supabase's `auth`/`realtime`, 42 checks centred on the slug migration and the registration rules it touches |
| **IT** | Implemented, but needs real integration testing. The code exists and type-checks, but it has never run against the real service |
| **P** | Partially implemented |
| **M** | Missing |
| **B** | Blocked by external credentials or configuration (often in addition to IT) |

UI previews (`/dev/ui/*`) and sample data prove nothing about integrations. `scripts/e2e-api.mjs` and
`scripts/staging-check.mjs` are written but **have never run**, because no staging project or test accounts exist.

---

## 1. Existing backend architecture

| Layer | Implementation |
|---|---|
| Hosting | Next.js 16.4.6 (App Router, Cache Components) on Vercel (`vercel.json`). Route handlers under `src/app/api`, server actions for auth, onboarding and profile |
| Database / auth | Supabase Postgres with RLS on every table. Supabase Auth: password, magic link, PKCE / `token_hash` callback, anonymous sign-ins for guests. `src/proxy.ts` refreshes the session and applies coarse redirects; pages and APIs re-check with `requireUser` / `requireApiUser` |
| Business rules | In SQL: `security definer` functions with `search_path=''`, plus triggers. Plan limits, registration, approval cap, lifecycle (`start_webinar` / `end_webinar`), join-link claim, room RPCs, slugs |
| Realtime | Supabase Realtime private channels `room:<id>` (database-only broadcasts plus presence) and `room:<id>:reactions` (client broadcast), authorised by RLS on `realtime.messages` via `webinar_role()` |
| Video | Agora RTC. Tokens are minted server-side (`/api/webinars/:id/rtc-token`) only while the webinar is live. Fixed host uids 1 and 2; random attendee uids; renewal on `token-privilege-will-expire`; auto-rejoin |
| Payments | Razorpay Subscriptions over REST with no SDK: `subscribe`, `verify` (HMAC + server re-read + owner check), `cancel` (at cycle end), `webhook` (HMAC, upsert). The `subscriptions` table is written only with the service role |
| Email | Resend over REST. `email_log` (primary key `registration_id, kind`) is an at-most-once claim ledger. Confirmation and go-live mails are sent in `after()`; reminders come from `/api/cron/emails`, protected by `CRON_SECRET` and meant to be called by `pg_cron` |
| Recording | Browser-only. MediaRecorder writes 2 s chunks to IndexedDB, with crash recovery and save-to-file. A replay is an HTTPS URL that the host pastes (`recordings` table, RLS: host or approved registrant) |
| Tests | `test:db` (PGlite, 42 checks), `test:staging-guard` (33 unit tests of the staging safety guard), `test:e2e` (written, never run), `staging-check.mjs` (written, never run) |

---

## 2–3. Findings by system

### 2.1 Authentication, account isolation and RLS

| Requirement | Class | Evidence and notes |
|---|---|---|
| Sign-up, sign-in, magic link, reset, resend confirmation | IT, B | `(auth)/actions.ts`: generic errors, `safeNextPath`. Needs a real project, SMTP, and Site URL / Redirect URLs set to `https://webinar.deployandgrow.com` |
| Owner-only rows on webinars, registrations and recordings | V (partial), IT | RLS policies in every migration. PGlite covers registrations, My events isolation and join tokens. Webinar CRUD isolation is covered only by the unrun `e2e-api.mjs` |
| Room tables reachable only through functions | IT | No client policies; grants revoked and restated (`realtime_room.sql` §Grants) |
| Guests can't host | IT | `"webinars: guests can't create"` policy and `requireUser` without `allowGuest` |
| Bot protection (CAPTCHA / Turnstile) | **M** | No Turnstile or CAPTCHA anywhere. Register is open to anonymous sessions, so mass registrations and confirmation-mail abuse are possible. |
| Rate limiting outside the room | **M** | Only Supabase Auth's built-in limits. Nothing on `register`, `subscribe`, `verify` or `updateProfile` |
| Security headers (CSP, HSTS, `frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`) | **M** | No `headers()` in `next.config.ts`; pages can be framed (clickjacking on billing and settings) |
| Account deletion and data export (India DPDP Act) | **M** | Foreign keys cascade on `auth.users`, but there is no user-facing deletion or export |
| Anonymous-user clean-up | **M** | Guest sessions accumulate in `auth.users` |

### 2.2 Free plan limits

| Requirement | Class | Evidence and notes |
|---|---|---|
| One webinar per free account | IT | Insert trigger `enforce_webinar_plan_limit` with a per-host advisory lock, plus `webinar_usage` so a webinar that has run still counts after deletion. `start_webinar` also blocks a second live run. **Not covered by `test:db`** |
| 100-attendee maximum | V (PGlite) | `register_for_webinar` and the approval trigger `enforce_registration_cap` count pending + approved registrants. The host's own capacity is capped at 100 on Free |
| Semantics to confirm | Decision | The cap counts **registrants**, not concurrent viewers. If a Pro plan lapses, existing registrants above 100 stay; only new ones are blocked |

### 2.3 Pro monthly subscription at configurable ₹499

| Requirement | Class | Evidence and notes |
|---|---|---|
| Pro grants unlimited webinars and attendees | IT | `user_plan()`: active, authenticated, pending or cancelled with `current_period_end` + 1 day in the future |
| Configurable price | **P** | The amount charged comes from the Razorpay plan (`RAZORPAY_PLAN_ID`). The displayed price is the code constant `PRO_PRICE_INR = 499`, and nothing checks that the two match. Changing the price means a code change, and the screens can silently disagree with the charge |

### 2.4 Razorpay

| Requirement | Class | Evidence and notes |
|---|---|---|
| Create subscription, Checkout, signature verification | IT, B | Constant-time HMAC; server re-reads the subscription; `notes.user_id` owner check. Needs test keys, a test plan and an HTTPS webhook URL |
| Webhook signature and basic idempotency | IT, B | Raw-body HMAC; upserts Razorpay's entity; returns 500 so Razorpay retries; ignores events for a superseded subscription |
| Duplicate and out-of-order events | **P** | No event-id ledger and no ordering guard. An older event delivered late (retries arrive out of order) can overwrite a newer status or period. Every event re-writes the row |
| Renewals | IT | `subscription.charged` carries the new `current_end`, which is saved |
| Cancellation | **P** | In-app cancel sets `cancel_at_period_end`. A cancel made elsewhere (Razorpay dashboard, customer link) arrives by webhook, but nothing sets the flag, so the UI says "renews on" |
| Payment failure / dunning | IT | `pending` keeps access until the period ends; `halted` is Free. Customer emails come from Razorpay (`customer_notify: 1`) |
| Refunds | **M** | No `payment.*` / `refund.*` handling, no payments ledger and no refund policy. A refunded Pro keeps access until the period ends |
| Payments and invoice record | **M** | No `payments` table, so there is no history, no reconciliation and no GST-invoice reference (backlog 16) |
| Abandoned checkouts | **P** | Each `subscribe` call creates a new Razorpay subscription and overwrites our row. Old `created` subscriptions are never cancelled or reused |

### 2.5 Webinars, registration, approval, guest join

| Requirement | Class | Evidence and notes |
|---|---|---|
| Create, schedule, edit and delete (zod plus DB checks; `live`/`ended` server-only) | IT | `guard_webinar_status` trigger and column-level grants. API tests exist in `e2e-api.mjs`, unrun |
| Registration: custom fields, required answers, approval, capacity | V (PGlite) | `register_for_webinar` |
| Secure guest join | V (PGlite) + IT | Unguessable `join_token`, click-gated `/join/<token>`, `claim_registration`: an account-held link can't be stolen; guests are anonymous sessions. Needs anonymous sign-ins enabled on the real project |
| Cancel or reschedule notifies registrants | **M** | Changing `starts_at` or cancelling sends nothing. After a reschedule the reminders already claimed in `email_log` never re-send for the new time |
| Delete while live | **P** | RLS allows the host to delete a live webinar, which cascades through the room |
| Registrations CSV export | **P (security)** | Client-side `csvEscape` doesn't neutralise formulas (`=`, `+`, `-`, `@`). Attendee-supplied names or answers can run as formulas in Excel or Sheets |
| Unverified guest email | Decision + **M** | A guest can register any email address, which then receives the confirmation. Turnstile and rate limits mitigate this |

### 2.6 Host and attendee permissions

| Requirement | Class | Evidence and notes |
|---|---|---|
| Roles via `webinar_role()`; host-only RPCs; approved-only attendee tokens | IT | Checked in every room function and in `rtc-token` |
| Presence identity | **P (security)** | The presence key and metadata (`userId`, `name`, `handRaisedAt`) come from the client. An attendee can spoof another user's id or name, inflate the live count with extra presences, or get the host to "remove" the wrong person, because `remove_room_attendee` acts on the presence `userId` |
| Attendees can't publish | **B** | The SUBSCRIBER role is enforced only when Agora "co-host authentication" is on for the project (code comment, `agora/server.ts`). Otherwise an attendee can publish; it isn't shown, but it costs minutes |
| Removed attendee loses video | **P** | Removal stops Realtime and token renewal, but the current Agora token stays valid for up to 1 h |
| Co-host / panelist / practice mode | **M on this branch** | Implemented on the **unmerged** branch `origin/phase-7-webinar-room` (`366ccb7`, from `main`, before the UI work). See the P0 migration collision below |

### 2.7 Agora and lifecycle

| Requirement | Class | Evidence and notes |
|---|---|---|
| Audio/video, screen share (second uid), dual stream, token renewal, reconnect | IT, B | `use-broadcast.ts` (unchanged since Phase 4). **Never run against a real Agora project or on real devices.** This still blocks production (Phase 5) |
| Start / end lifecycle and broadcast | IT | `start_webinar` / `end_webinar` with a status broadcast; the end path also clears recording and spotlight |
| Abandoned live webinars | **M** | If the host closes the tab, the webinar stays `live` forever: the room stays open and tokens keep issuing. There is no auto-end job |

### 2.8 Chat, Q&A, polls, interactions

| Requirement | Class | Evidence and notes |
|---|---|---|
| Chat with history, slow mode, per-user limit (10 s window); Q&A (30 s, max 500); polls (max 20); spotlight; answered; hand raise; remove attendee | IT | `realtime_room.sql`, `plans_billing.sql`. Text sanitising via `room_clean_text` |
| Rate limits on votes, upvotes and reactions | **M** | Reactions are client-to-client broadcasts limited only in the browser; votes and upvotes have no server limit |
| Moderation (delete or pin message, ban words) | **M** | Prototype backlog 14 |
| Retention / clean-up of room tables | **M** | Rows are kept forever |

### 2.9 Recording

| Requirement | Class | Evidence and notes |
|---|---|---|
| Local recording, IndexedDB chunks, crash recovery, save / download, storage-unavailable state | IT (client) | Needs real-device testing: Safari MediaRecorder codecs, multi-GB files, storage quota |
| Replay page (host or approved registrant) | IT | Host pastes a direct HTTPS MP4/WebM URL. The DB check requires `https://` |
| Visibility, expiry, rename | **M** | Backlog 15 |
| Cloud recording, processing, automatic replays | **M** | Backlog 20. Needs a storage decision, and **AWS is not allowed** |

### 2.10 Email

| Requirement | Class | Evidence and notes |
|---|---|---|
| Account verification email | IT, B | Supabase link flow; needs SMTP (Resend) and Site URL configured |
| Confirmation (+ `.ics`), 24 h / 1 h reminders, go-live, live catch-up; exactly-once ledger; Resend idempotency keys | IT, B | Needs `RESEND_API_KEY`, a verified domain, `CRON_SECRET`, and a `pg_cron` job (not scheduled anywhere; Vercel Hobby crons run daily only) |
| Pending-approval and rejected emails | **M** | Only approved registrants get mail |
| Cancel / reschedule emails | **M** | See §2.5 |
| Invitations (email or CSV import) | **M** | Backlog 9 |
| Unsubscribe link, `List-Unsubscribe` header, bounce/complaint suppression | **M** | No Resend webhook and no suppression list. Gmail and Yahoo bulk-sender rules expect one-click unsubscribe for bulk mail; reminders to large lists are at risk |
| Custom reminders; host notified on new registration; ZeptoMail custom sender | **M** | Backlog 8 and 11 |

### 2.11 Offers, CTA, conversion tracking — **M**
There are no tables, APIs or room events, and the UI shows these as "Coming soon".

### 2.12 Attendance and analytics — **M**
There is no join/leave record. Presence is ephemeral and spoofable, so it can't be the source. The dashboard only shows
registration counts.

### 2.13 Slug migration and old links

| Requirement | Class | Evidence and notes |
|---|---|---|
| `webinars.slug`, `get_public_webinar_by_slug` (public, non-draft only), `list_my_registrations`, rollback | V (PGlite, 42 checks) | **Not applied to any project.** The staging runbook exists; no staging project does |
| Old `/register/<uuid>` and `/join/<token>` links | IT | Routes unchanged; the production build returns identical status codes before and after |
| **Migration version collision** | **P0 risk** | `origin/phase-7-webinar-room` adds `20261030000000_panelists_practice.sql`, **the same version** as `20261030000000_event_slugs.sql`. If that branch's migration was ever pushed to a project, `supabase db push` treats our slug migration as already applied, or fails. I can't see production's `supabase_migrations.schema_migrations`. **This needs the owner to check before any push** |

### 2.14 Environment, logging, recovery, rate limiting, security

| Requirement | Class | Evidence and notes |
|---|---|---|
| Env handling | P | `env.ts` requires only the Supabase URL and key. Billing, video and email degrade gracefully when unset (503 or "opening soon"), but nothing validates them at boot or flags a mismatch (e.g. live Razorpay keys with a test plan) |
| Logging and alerting | **M** | `console.error` only: no error tracking, request ids, alerting on webhook or cron failure, or health endpoint |
| Error recovery | IT | Webhook 500s trigger Razorpay retry; email claims are released on failure; room snapshot on reconnect; Agora auto-rejoin |
| Backups / PITR | B | A Supabase plan setting; not visible from code |
| Development dependency advisories | **Open security review** | 22 advisories (13 high, 9 moderate), all in dev tooling: `shadcn@4.22.1` → `@modelcontextprotocol/sdk` → `hono` / `@hono/node-server` (an HTTP server, reachable only if someone runs the shadcn MCP server), `@dotenvx/dotenvx`, `fast-glob` → `picomatch` (ReDoS); `eslint-config-next` → `tinyglobby` → `picomatch`. They are not in the production bundle (`npm audit --omit=dev` is 0), but they run on developer machines and in CI. This is reviewed as a task below and not dismissed |

---

## 4. Integration testing blockers (credentials and configuration)

None of these can be done from this session. Each needs owner action.

1. **An approved staging Supabase project** (ref, anon key, service-role key in `.env.staging.local`), with anonymous sign-ins on, `pg_cron` / `pg_net`, and Site URL / Redirect URLs set. Every migration (including slugs) must be applied there first.
2. **Production migration inventory**: the output of `select version, name from supabase_migrations.schema_migrations order by version;` on production. This resolves the 20261030000000 collision.
3. **Razorpay test mode**: `rzp_test_` keys, a ₹499 monthly test plan id, a webhook secret, and a publicly reachable HTTPS URL for the webhook (a staging Vercel deployment).
4. **Agora** staging project: App ID + App Certificate, with co-host authentication enabled.
5. **Resend**: API key, a verified sending domain, and an inbox you own for tests.
6. **Two real devices**: iOS Safari and Android Chrome, plus two desktop browsers, for the Phase 5 live-session test.
7. **Two confirmed test accounts** for `e2e-api.mjs` and `staging-check.mjs`.
8. **Legal content**: Terms, Privacy, Refund/Cancellation policy and a Contact address. Razorpay requires these on the site to activate a live account.

The Phase 5 blockers still stand: the room is **not production-ready** until a real Agora + Supabase session passes
on real devices (host publish, toggles, screen share, attendee A/V, reconnect, chat / Q&A / polls / hands / reactions
across two or more browsers, local recording save, end-for-everyone).

---

## 5. Prioritised Phase 7 tasks

Every task reuses the existing pattern: SQL functions with RLS for rules, thin route handlers, the service role only
where needed, and tests in `test:db` (PGlite) for every migration. No AWS. New migrations get versions after
`20261030000000` (for example `20261118000000_…`), never reusing a timestamp.

### P0: production-critical

#### T1. Migration reconciliation and branch decision
- **Expected:** one linear, conflict-free migration history; we know exactly what production has.
- **Existing:** slug migration (unapplied), plus the unmerged panelists migration with the same version.
- **Missing:** inventory of production's applied migrations, and a decision on `phase-7-webinar-room` (port its panelists/practice work onto this branch later, or drop it).
- **Backend changes:** if panelists stays, rename its migration to a new version when porting. If the slug version was already taken in production, rename the slug migration (it is unapplied, so that is safe).
- **DB:** none new.
- **Security:** a wrong history can silently skip RLS-bearing migrations.
- **Dependencies:** owner runs one read-only query on production.
- **Cost:** none.
- **Acceptance:** `supabase db push --dry-run` on staging lists exactly the expected files, and `test:db` applies the full sequence.

#### T2. Razorpay webhook hardening and payments ledger
- **Expected:** every event processed once, in order. Cancellations made anywhere are reflected. Payments and refunds are recorded.
- **Existing:** signature check and upsert of the current entity.
- **Missing:** event dedupe, ordering, `cancel_at_period_end` from webhooks, `payment.*` / `refund.*` handling, reuse or cancel of abandoned `created` subscriptions.
- **Backend changes:** extend `/api/billing/webhook`:
  - insert into `billing_events` first; a duplicate id returns 200 with no work;
  - apply a change only if the event is newer than `subscriptions.last_event_at`;
  - map `subscription.cancelled` and scheduled changes onto `cancel_at_period_end`;
  - record `subscription.charged` payments and `refund.processed`.

  In `subscribe`: reuse the user's still-`created` subscription if it is under 24 h old, or cancel it before creating a new one.
- **DB:**
  - `billing_events (id text pk, event text, entity_id text, created_at timestamptz, received_at timestamptz default now())`
  - `payments (razorpay_payment_id text pk, user_id uuid, razorpay_subscription_id text, amount_paise int, currency text, status text, refunded_paise int default 0, captured_at timestamptz)`
  - `subscriptions.last_event_at timestamptz`

  All service-role only. Owners can read their own payments.
- **Security:** keep raw-body HMAC; never trust payload amounts for access, which still comes from subscription status; store no card data.
- **Dependencies:** Razorpay test keys and plan; webhook events `subscription.*`, `payment.captured`, `payment.failed`, `refund.processed`.
- **Cost:** none beyond Razorpay's per-transaction fees.
- **Tests:** PGlite checks for ledger dedupe and ordering; route tests with HMAC-signed fixtures (no network), covering a duplicate event, an older event after a newer one, cancel from the dashboard, and refund; then a Razorpay test-mode run of subscribe → charge → renew (test clock or plan with a short interval) → cancel → refund.
- **Acceptance:** replaying every fixture twice and in shuffled order leaves the same final row.

#### T3. Bot protection and rate limiting
- **Expected:** automated sign-ups, registrations and checkout spam are blocked without hurting real users.
- **Existing:** room-function limits and Supabase Auth limits.
- **Missing:** Turnstile on register, sign-up, login, magic link and reset; server limits on register, subscribe, verify and profile update.
- **Backend changes:**
  - `verifyTurnstile(token, ip)` helper, called in the auth actions and the register route;
  - Supabase Auth CAPTCHA turned on with the same Turnstile keys;
  - a Postgres fixed-window limiter, `check_rate_limit(p_key text, p_limit int, p_window interval)`, keyed by IP and user;
  - the client IP taken from `x-forwarded-for` as set by Vercel.

  Using Postgres avoids a new Redis vendor.
- **DB:** `rate_limits (key text, window_start timestamptz, count int, primary key (key, window_start))` with a clean-up in the cron.
- **Security:** fail closed on register and subscribe, and fail open on a Turnstile outage only for login (decision).
- **Dependencies:** a Cloudflare Turnstile site key and secret (free).
- **Cost:** none, apart from a little DB load.
- **Tests:** PGlite limiter tests; route tests (missing or invalid token → 400; over limit → 429); a manual check on staging.
- **Acceptance:** 20 rapid registrations from one IP are cut off at the limit with 429, and real sign-up still works.

#### T4. Integration test programme (staging)
- **Expected:** every IT item above is moved to V by tests that ran against real services.
- **Existing:** `e2e-api.mjs`, `staging-check.mjs` and `staging-guard` (the guard refuses non-staging refs).
- **Missing:**
  - test runs;
  - a billing test-mode script;
  - a two-browser Playwright room test (two contexts, fake media devices);
  - a real-device checklist with results recorded in the docs.
- **Backend changes:** scripts only.
- **DB:** none.
- **Security:** staging guard on every script; test data cleaned up; no production credentials in the repo.
- **Dependencies:** §4 items 1, 3–7.
- **Cost:** staging projects on free tiers where possible.
- **Acceptance:** the documented pass list covers §2.1–2.10, and the Phase 5 real-device list is recorded as passed.

#### T5. Legal and policy pages (content from owner; small code)
- **Expected:** Terms, Privacy, Refund/Cancellation and Contact pages exist with real text. Razorpay live activation needs them.
- **Backend:** the Contact form needs a sink, either email through Resend to the support address or a `contact_messages` table. Turnstile and rate limits apply.
- **Acceptance:** pages are reachable from the footer and checkout; content is approved by the owner.

### P1: important

#### T6. Webinar lifecycle safety
- **Expected:**
  - abandoned live webinars end on their own;
  - a reschedule resets reminders and emails registrants;
  - a cancellation emails registrants;
  - a live webinar can't be deleted.
- **Backend changes:**
  - extend the cron to end webinars that are `live` beyond `starts_at + duration + 2 h` with no host heartbeat (heartbeat from T9);
  - a trigger on `starts_at` change that deletes `reminder_24h` / `reminder_1h` rows in `email_log` for that webinar and queues `rescheduled`;
  - a `cancelled` email;
  - deletion blocked while `live`, via the RLS delete policy or a trigger.
- **DB:** `email_kind` gains `rescheduled` and `cancelled`; one trigger.
- **Tests:** PGlite (trigger resets claims; deleting a live webinar is rejected); staging email check.

#### T7. Email compliance and missing transactional mail
- **Expected:**
  - one-click unsubscribe on reminder and marketing-like mail (never on account or security mail);
  - bounces and complaints suppress future sends;
  - pending-approval and rejected emails.
- **Backend changes:**
  - `List-Unsubscribe` + `List-Unsubscribe-Post` headers;
  - a signed `/api/email/unsubscribe?t=…` link (HMAC of registration id and kind);
  - a `/api/webhooks/resend` route with Svix signature verification for bounce and complaint;
  - `deliver()` skips suppressed addresses;
  - new kinds `pending` and `rejected`.
- **DB:** `email_suppressions (email citext pk, reason text, created_at)`; `email_kind` gains `pending` and `rejected`.
- **Security:** unsubscribe tokens are unforgeable and scoped; webhook signatures are verified.
- **Dependencies:** a Resend webhook secret.
- **Cost:** none (same email volume).

#### T8. Offers / CTA with click tracking
- **Expected:**
  - the host creates offers (title, button text, HTTPS URL) and shows or hides one on stage live;
  - attendees see it pop up;
  - impressions and clicks are counted per attendee.
- **Backend changes:**
  - room RPCs `create_offer` / `update_offer` / `show_offer` / `hide_offer` (host only), broadcast `offer:shown` / `offer:hidden`;
  - `record_offer_impression` (attendee, deduped per user);
  - a click endpoint `/o/:offerId` that records the click (auth optional) and 302-redirects only to the offer's stored URL, so it can't be used as an open redirect.
- **DB:** `offers (id, webinar_id, title, button_text, url check (url ~ '^https://'), active bool, shown_at, created_at)`, `offer_events (offer_id, user_id, kind ('impression' or 'click'), at)` with unique `(offer_id, user_id, kind)` for unique counts. Host-read RLS; writes through functions.
- **Security:** HTTPS-only URLs; rate limit on clicks; no user-supplied redirect targets.
- **Cost:** a few extra Realtime messages per webinar.
- **Tests:**
  - PGlite: RPC role checks, dedupe;
  - route: the redirect only goes to the stored URL;
  - staging: two browsers.
- **Acceptance:** the host shows an offer and the attendee sees it within 1 s. The host dashboard shows unique impressions and clicks.

#### T9. Attendance tracking and analytics
- **Expected:**
  - accurate join/leave per registrant;
  - peak and average concurrent viewers;
  - average watch time;
  - attendance rate (attended / registered);
  - CTA clicks;
  - a host-only CSV export.
- **Backend changes:**
  - `room_heartbeat(p_webinar_id)` RPC, called every 30 s by the room client; uses `auth.uid()`, so it can't be spoofed;
  - sessions close after 90 s without a heartbeat;
  - `get_webinar_analytics(p_webinar_id)` (host only);
  - a streamed CSV route `/api/webinars/:id/attendance.csv` with formula-safe escaping.

  The heartbeat also feeds T6's host-alive check, and gives T10 a trusted roster.
- **DB:**
  - `attendance_sessions (id, webinar_id, user_id, registration_id, joined_at, last_seen_at, left_at)`;
  - index `(webinar_id, last_seen_at)`;
  - optional per-minute `attendance_samples` for peak viewers.
- **Cost:** one small write per viewer every 30 s. At 100 viewers that is about 200 writes a minute, which is fine. Revisit above roughly 1,000 viewers (batch or sample instead).
- **Tests:** PGlite (session open/extend/close, analytics maths on fixtures); staging, two browsers.

#### T10. Room security hardening
- **Expected:** identity in the room can't be spoofed, and abuse is limited server-side.
- **Changes:**
  - the roster and `remove_room_attendee` use DB-verified identities: T9 sessions plus `room_display_name`, not presence metadata;
  - presence is kept only as a UI hint;
  - server limits on `vote_poll`, `toggle_question_upvote` and reactions (reactions go through an RPC, or the reaction topic is dropped for a batched DB function);
  - enable Agora co-host authentication;
  - optionally shorten the attendee token TTL to 10–15 min so removal bites sooner (renewal already exists).
- **Tests:** PGlite role and limit tests; staging spoof attempt with a modified client fails.

#### T11. Security headers and CSV injection fix
- **Changes:**
  - `headers()` with CSP (allow self, Supabase, Agora, Razorpay Checkout and Turnstile hosts), HSTS, `frame-ancestors 'none'`, `nosniff` and `Referrer-Policy`;
  - prefix `'` to cells starting with `= + - @` (tab or CR) in the client CSV export and the T9 export.
- **Tests:** the header check script; a CSV unit test.

#### T12. Pricing configuration consistency
- **Expected:** one source of truth for the Pro price.
- **Changes:** read the plan's amount from Razorpay (`GET /plans/:id`, cached) on the server for the billing and upgrade screens, with the code constant only as a fallback. Refuse checkout and alert if the env plan isn't monthly INR. The UI must never show a price different from the charge.
- **DB:** none.
- **Tests:** a mocked plan fetch; test mode with a different plan amount.

#### T13. Observability
- **Changes:**
  - structured error logging with a request id in `handler()`;
  - an error-tracking service (for example Sentry's free tier, or Vercel log drains);
  - alerts on webhook 5xx, cron failure and email send failures;
  - a `/api/health` endpoint (DB ping, config presence, no secrets).
- **Cost:** a free tier to start.

#### T14. Account deletion and data export (DPDP)
- **Changes:**
  - a server action that cancels any Razorpay subscription, then deletes the user with the admin API (FK cascades exist);
  - export of the user's webinars, registrations and recordings metadata as JSON.
- **Security:** re-authentication or email confirmation before deletion.

#### T15. Development dependency security review
- **Changes:**
  - move `shadcn` out of `devDependencies` (run `npx shadcn@<pinned>` when adding components), which removes the `@modelcontextprotocol/sdk` / `hono` / `dotenvx` chain;
  - bump `eslint-config-next` / `eslint-import-resolver-typescript` when a patched `tinyglobby` / `picomatch` is available;
  - document anything left with the reason.
- **Acceptance:** `npm audit` (dev) is reduced, and each remaining advisory is listed with its exposure.

### P2: later

| Task | Summary | DB |
|---|---|---|
| T16 Invitations | Email and CSV import (size and row caps), sent through the email pipeline, with unsubscribe from T7 | `invitations` |
| T17 Custom reminders | Per-webinar schedules; generalised `email_kind` | `reminder_schedules` |
| T18 Recording metadata | Visibility, expiry, rename | `recordings` columns |
| T19 Invoice history | Read from T2 `payments` plus Razorpay invoices | none |
| T20 Cloud recording | Agora Cloud Recording to **non-AWS** storage. Verify which vendors Agora supports; candidates are Cloudflare R2 or Google Cloud Storage. Processing / ready / failed states | `recordings` status columns |
| T21 Panelists / practice mode | Port from `phase-7-webinar-room` after T1, under a new migration version, on top of the Phase 5 UI | `room_participants`, practice columns |
| T22 Chat moderation | Delete, pin, word filter | `room_messages` columns |
| T23 Data retention | Purge room data, `rate_limits`, `billing_events` and stale anonymous users on a schedule | none |
| T24 ZeptoMail custom sender | Encrypted per-workspace credentials (backlog 11) | `email_senders` |

---

## 6. Required database and API changes (summary)

New migrations, all additive, each with a rollback file and `test:db` coverage:

| Migration (proposed version) | Objects |
|---|---|
| `20261118000000_billing_ledger` | `billing_events`, `payments`, `subscriptions.last_event_at` |
| `20261118010000_rate_limits` | `rate_limits`, `check_rate_limit()` |
| `20261118020000_lifecycle_email` | `email_kind` += `pending`, `rejected`, `rescheduled`, `cancelled`; `email_suppressions`; reschedule trigger; live-delete guard |
| `20261118030000_attendance` | `attendance_sessions`, `room_heartbeat()`, `get_webinar_analytics()`, roster function |
| `20261118040000_offers` | `offers`, `offer_events`, offer RPCs |
| `20261118050000_room_limits` | Server limits for votes, upvotes and reactions |

New or changed routes:
- `POST /api/billing/webhook` (extended);
- `POST /api/webhooks/resend`;
- `GET /api/email/unsubscribe`;
- `GET /o/:offerId`;
- `GET /api/webinars/:id/analytics`;
- `GET /api/webinars/:id/attendance.csv`;
- `GET /api/health`;
- cron extended (lifecycle, clean-up);
- account delete and export server actions;
- Turnstile verification in the auth actions and `register`.

## 7. Testing strategy

1. **Database (PGlite, `test:db`):** extend it from the slug-only checks to every migration: plan limits (including the free-webinar race), billing ledger dedupe and ordering, rate limiter, attendance, offers, room limits and RLS for each new table. It runs in CI and never touches a real database.
2. **Route tests without network:** HMAC-signed Razorpay fixtures, Svix-signed Resend fixtures, Turnstile stubbed at the fetch boundary, and a check that the CSV export escapes formulas.
3. **Staging integration** (guarded by `staging-guard`, never production): `e2e-api.mjs`, `staging-check.mjs`, Razorpay test mode end to end, Resend to owned inboxes, and `pg_cron` runs.
4. **Room:** a two-browser Playwright test with fake media, then the manual real-device checklist (Phase 5).
5. **Load:** 50 / 80 / 100 concurrent viewers on staging, measuring Realtime messages, DB writes from heartbeats, and Agora quality.
6. **Release gate:** every P0 task passes with recorded results in `docs/`; the owner signs off on legal pages and the production migration inventory.

## 8. Infrastructure and operating cost categories

These are categories and their drivers only. Check current rate cards before budgeting.

| Category | Driver | Phase 7 impact |
|---|---|---|
| Supabase | Plan tier, DB size, Realtime concurrent connections and messages, egress, PITR / backups add-on | Small increase: heartbeats (T9), ledgers (T2) and rate limits (T3) |
| Agora | Participant-minutes by resolution (for example 100 attendees × 60 min ≈ 6,000 participant-minutes per webinar, plus the host); free monthly allowance; cloud recording billed separately | None unless T20. T10 co-host authentication prevents unpaid attendee publishing |
| Vercel | Plan tier, function invocations and duration; Hobby crons are daily only, so use `pg_cron` | Small (new routes) |
| Resend | Emails per month by tier: about 3–5 mails per registrant (confirmation, 2 reminders, live, plus new pending, rescheduled and cancelled) | Moderate growth with T6, T7 and T16 |
| Razorpay | A percentage fee plus GST per successful charge; no fixed fee | None |
| Cloudflare Turnstile | Free | New (T3) |
| Error tracking | Free tier to start | New (T13) |
| Replay storage (T20 only) | Storage plus egress; R2 has no egress fees, GCS charges egress | Deferred |

## 9. Production readiness blockers

1. Real Agora + Supabase live session on real devices (Phase 5). **Not done.**
2. Production migration inventory and the 20261030000000 collision (T1).
3. Razorpay hardening (T2) plus a passed test-mode run; live keys only after KYC with legal pages (T5).
4. Bot protection and rate limits (T3).
5. Staging integration programme passed (T4): auth emails, guest join, approval, capacity, reminders via `pg_cron`, `updateProfile`.
6. Production configuration verified by the owner:
   - Supabase Site URL / Redirect URLs;
   - anonymous sign-ins;
   - Agora certificate and co-host authentication;
   - Razorpay keys, plan and webhook;
   - Resend domain;
   - `CRON_SECRET` and the `pg_cron` job;
   - backups / PITR.
7. Security headers and CSV formula fix (T11). Small, but should ship before launch.
8. Development dependency review (T15) completed and documented.

## Decisions needed from the owner before Phase 7 starts

1. **Production migrations:** what does `supabase_migrations.schema_migrations` contain? Was `20261030000000_panelists_practice` ever applied?
2. **`phase-7-webinar-room` branch:** port its panelists and practice work later (T21), or drop it?
3. **Refund policy:** on refund, revoke Pro immediately or keep it until the period ends?
4. **Free cap:** is "100 attendees" counted as registrants (current) or concurrent viewers?
5. **Turnstile outage behaviour:** fail closed everywhere, or allow login?
6. **Offers scope for v1:** external HTTPS links only (proposed), with no on-platform payments (paid tickets stay deferred)?
7. **Data retention:** how long to keep chat/Q&A, attendance and billing events?
