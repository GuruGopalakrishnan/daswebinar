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
| B2 | **No email at all**: no confirmation with the join link, no reminders, no "we're live", no replay email | Attendance on webinar platforms depends on reminders. Without them, show-up rates will be low | Next (P0) |
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
- [ ] Transactional email (Resend or Postmark): confirmation with join link + .ics, reminders at 24 h / 1 h / 10 min, "we're live", replay
- [ ] Scheduled jobs for reminders (Supabase `pg_cron` + Edge Function, or Vercel Cron)
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
