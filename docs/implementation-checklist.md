# Project audit and implementation checklist

Audit date: 2026-10-27. Scope: the whole repo (`src/`, `supabase/migrations/`, config, env).

## 1. Current architecture

| Layer | What's used | Verdict |
|---|---|---|
| Frontend | Next.js 16.4 App Router (Cache Components / partial prerendering), React 19.3, Tailwind 4, shadcn/Radix UI, `motion` | Keep. Modern and fast |
| Backend | Next.js Route Handlers + Server Actions, JSON API with typed errors (`src/lib/api/http.ts`) | Keep |
| Database | Supabase Postgres, RLS on every table, business rules in `security definer` functions and triggers | Keep. This is the strongest part of the codebase |
| Auth | Supabase Auth (password + magic link, PKCE / token-hash callback), session refresh in `src/proxy.ts`, `requireUser()` on every page | Keep |
| Realtime | Supabase Realtime private channels: chat, Q&A, polls, hand raise, presence, reactions. Writes only through DB functions | Keep |
| Live video | Agora RTC live-broadcast mode: host camera (uid 1) + screen (uid 2), dual stream, auto-rejoin | Keep |
| Recording | Local: canvas composite → MediaRecorder → IndexedDB chunks, crash-safe | Keep. Cloud recording later |
| Payments | Razorpay Subscriptions, HMAC-verified checkout + webhook, plan limits enforced in SQL | Keep |
| Hosting | Vercel (`vercel.json`), Supabase cloud | Keep |

**Reuse verdict:** nothing needs rebuilding. Typecheck, lint and the production build all pass. The UI is
already original (not a WebinarGG or Zoom copy), and Zoom's *behaviours* were adopted deliberately
(`docs/zoom-research.md`). The work ahead is filling product gaps, not rewriting.

## 2. Issues found

### Broken or missing functionality

| # | Issue | Impact | Status |
|---|---|---|---|
| B1 | **Guest registrants could never join the live room.** They were told to create an account, log in and register again | Biggest attendance leak in the funnel | **Fixed** (guest join, see README) |
| B2 | **No email at all**: no confirmation with the join link, no reminders, no "we're live", no replay email | Attendance on webinar platforms depends on reminders. Without them, show-up rates will be low | **Fixed** (Resend; needs keys + scheduler) |
| B3 | Local `.env.local` has no `AGORA_APP_ID`/`AGORA_APP_CERTIFICATE`, Razorpay keys or `SUPABASE_SERVICE_ROLE_KEY`. It still lists the old `NEXT_PUBLIC_SOCKET_URL` and `NEXT_PUBLIC_AGORA_APP_ID` (the code reads `AGORA_APP_ID`) | Video and billing return 503 in local dev | Needs your keys |
| B4 | Replays need a manual upload to YouTube/Drive and a pasted link | Friction for every webinar | P1 |
| B5 | No host analytics (attendance rate, watch time, poll/Q&A export) | Coaches can't measure or follow up | P1 |

### Security

| # | Issue | Severity | Status |
|---|---|---|---|
| S1 | No rate limiting or bot protection on registration. A script can fill a capped webinar with fake emails. Guest sessions make this more relevant | Medium | P0: add Turnstile to the register, login and sign-up forms, then switch on Supabase CAPTCHA |
| S2 | Without `AGORA_APP_CERTIFICATE` (Agora "testing mode") anyone with the App ID can publish as the host uid | High in production | Set the certificate in production. Already documented |
| S3 | Poll votes, upvotes and reactions have no server-side rate limit | Low | P2 |
| S4 | Revoked attendees keep receiving Realtime until they reconnect (they can't write) | Low | P2 |
| S5 | Guest registrations aren't email-verified (by design, for conversion) | Low | Accepted. Join links come from the registrant or the host |

Checked and fine: Razorpay signature checks (constant-time, server re-reads the subscription), webhook
idempotency, open-redirect guards, generic auth errors, RLS on every table, no service-role key in client
code, 404-not-403 for other hosts' webinars.

### Repo hygiene

- **A large share of the app is uncommitted** (billing, recordings, dock, poll overlay, docs and more).
  Commit it soon. One lost working tree would lose all of it.

## 3. Implementation checklist

Priorities: **P0** before charging customers · **P1** what makes it premium and conversion-focused · **P2** later.

### P0: reliability and attendance
- [x] Guest join: register and join without an account; personal `/join/<token>` links; host can copy each attendee's link
- [ ] Apply migration `20261028000000_guest_join.sql` (`npx supabase db push`) and enable anonymous sign-ins
- [x] Email via Resend: confirmation with join link + .ics, 24 h and 1 h reminders, "we're live" (replay email still to do)
- [x] Scheduled job endpoint `/api/cron/emails` (schedule it with Supabase pg_cron, see README)
- [ ] Bot protection: Cloudflare Turnstile on register, login and sign-up; then Supabase CAPTCHA on
- [ ] Commit the current working tree

### P1: conversion features for coaches and consultants
- [ ] **Offer / CTA on stage**: host pins a button ("Book a call", "Buy now") that appears for every attendee, with click tracking
- [ ] Attendance analytics: joined / registered, peak viewers, average watch time, CTA clicks; CSV export of attendees with watch time
- [ ] Branded registration pages: cover image, host bio/photo, brand colour, testimonial block
- [ ] Replay page with an expiry ("available for 48 h") and the same CTA
- [ ] Promote attendee to speaker (second publisher token + speaker tile)
- [ ] Practice session: host and co-hosts can join live before attendees are admitted

### P2: scale and polish
- [ ] Cloud recording (Agora Cloud Recording to S3/R2), then automatic replays
- [ ] Server-side rate limits for votes, upvotes and reactions
- [ ] Live captions (browser speech API on the host, sent over Realtime)
- [ ] Co-host role (moderate chat/Q&A without publishing)
- [ ] Integrations: Zapier/webhooks on registration, Google Calendar, CRM tags
- [ ] Automated tests: extend `scripts/e2e-api.mjs` to cover guest join; Playwright for the room happy path

### Phase 2: UI/UX (2026-10-27)
- [x] Design system: elevation + motion tokens, `PageHeader`, `StatCard`, `EmptyState`, rules in `docs/design-system.md`
- [x] Landing page: reviewed on desktop and phone, nothing broken, left as is
- [x] Dashboard: fixed phone overflow, stat cards, shared empty states, first-run onboarding checklist
- [x] Fixed the `Date.now()` prerender error on every signed-in page (`src/lib/supabase/server.ts`)
- [x] Room (host + attendee): labeled bottom navigation on phones, decluttered dock with 44 px targets
- [x] Registration page: serif title, sticky "Save my seat" bar on phones
- [ ] Room: **panelist / speaker role** (needs a publisher token for promoted attendees, a speaker tile layout, and a promote/demote control for the host)
- [ ] Room on phones: switching mic/camera mid-session (device menus are desktop-only; phones pick devices on the pre-join screen)
- [ ] Dark-mode pass on the dashboard and registration page (tokens exist; not reviewed screen by screen)
- [ ] Webinar manage page, billing page and creation wizard: visual pass with the new components

### Phase 4: plans and enforcement (2026-10-27)
- [x] Verified the existing database enforcement end to end (16 checks: Free limits, Pro unlimited, 1-day grace, expiry and halted → Free) plus a 5-request race on webinar creation
- [x] `/pricing` (public) and `/upgrade` (checkout only when Razorpay is configured)
- [x] Upgrade modal on `402` from create / go live; upgrade card on New webinar at the limit
- [x] Host seat notice at 80 and 100 of 100 on the manage page; capacity shows the effective limit
- [x] Plan feature lists made honest (Pro listed features Free also has)
- [x] Fixed the pre-join device picker's controlled/uncontrolled warning
- [ ] Razorpay keys + plan id + webhook (Phase 5); the checkout code already exists
