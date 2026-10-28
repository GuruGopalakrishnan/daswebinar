# Deploy & Grow UI integration: audit and plan

Audit date: 2026-10-28. Branch: `feature/deploy-grow-ui-integration`. Nothing on `main` is changed.

**Goal:** bring the approved Deploy & Grow UI (Prototype V1) into this Next.js app, and keep every backend system
that already works. The goal is a better product, not a bigger one.

## 0. Snapshot

| Item | Value |
|---|---|
| Repo | `github.com/GuruGopalakrishnan/daswebinar` |
| Base commit | `18b71bcb24d2882d1f83aa76ebee4fb6bd9d015d` (`main`, "Phase 6 - auth fixes, password reset, onboarding redirect"), 10 commits |
| Working tree at branch time | Clean (fresh clone; no local clone existed on this machine) |
| Prototype ZIP (untouched original) | `C:\Users\gurug\dg-integration\ui-prototype-original\DeployAndGrow-Webinar-UI-V1.zip`, SHA-256 `7ba8b31a…0c78660de` |
| Prototype extracted (read-only reference) | `C:\Users\gurug\dg-integration\ui-prototype-extracted\` |
| Prototype size | 11 files: `app.css` (1,023 lines, 39 keyframes), 7 JS modules (~3,800 lines), 50 hash routes |
| Baseline checks | See §0.1 |

### 0.1 Baseline (before any change)

| Check | Result |
|---|---|
| `npm ci` | OK (715 packages) |
| `next typegen` + `tsc --noEmit` | Pass. Plain `tsc` on a fresh clone fails with `Cannot find name 'PageProps'` until `next typegen` (or `next dev`/`build`) generates the route types. Not a code bug |
| `npm run lint` | Pass, no warnings |
| `npm run build` (placeholder Supabase URL/key) | Pass. 32 routes; `/pricing` static, the rest partial prerender or dynamic |
| `npm run test:e2e` | Not run: needs a real Supabase project and keys |

## 1. Architecture comparison

| Layer | Project A (this repo) | Project B (prototype) | Decision |
|---|---|---|---|
| Framework | Next.js 16.4 App Router, Cache Components, React 19.3, TS | Static HTML + vanilla JS, hash router (`#/path`) | **Keep A.** Port B's screens to TSX |
| Rendering | Server Components + client islands | Template strings assigned to `innerHTML` (~30 sinks) | Rewrite as JSX. No `dangerouslySetInnerHTML` |
| Styling | Tailwind 4 + shadcn/Radix, oklch tokens in `globals.css` | One `app.css`, oklch tokens, hand-written classes | Move B's tokens into A's `@theme`; rebuild B's classes as Tailwind + variants |
| Icons | `lucide-react` | Hand-inlined Lucide-style paths | Use `lucide-react` (same shapes) |
| Motion | `motion` library, `Reveal`, CSS | CSS keyframes; `motion.js` generates SVG scenes, pauses offscreen, honours reduced motion | Port the SVG scenes as React components that generate keyframes at build time (no runtime `<style>` injection) |
| Data | Supabase Postgres, RLS on every table, rules in `security definer` functions/triggers | In-memory store saved to `localStorage` (`dg-proto-v3`) | **Keep A.** Drop B's store entirely |
| Auth | Supabase Auth: password, magic link, PKCE/token-hash, anonymous guests, `requireUser()` everywhere | Fixed OTP `246810`, roles switched from a debug panel | **Keep A.** Port B's auth screens only |
| Realtime | Supabase private channels; writes only via DB functions | Local arrays + simulated messages | **Keep A** |
| Video | Agora live broadcast, server-issued tokens, host uid 1 / screen uid 2 | Static tiles and slides | **Keep A** |
| Recording | Local MediaRecorder → IndexedDB chunks, crash recovery; replays by URL | Timer flips status to "ready" | **Keep A**; port B's library UI where it fits real data |
| Payments | Razorpay Subscriptions (HMAC verify + webhook) | Simulated checkout sheet with selectable outcome | **Keep A**. Ticket payments are new backend (§7) |
| Email | **Resend** (`src/lib/email/`), `email_log` exactly-once, cron via pg_cron | Toasts; integrations UI for SMTP/Postmark/Brevo/Resend/**ZeptoMail** | Keep A's pipeline. ZeptoMail is a decision (§12) |
| Brand | "Onstage" (`src/lib/brand.ts`) | "Deploy & Grow Webinar", `webinar.deployandgrow.com` | Rename through `BRAND` |

**Conclusion:** A's backend is sound and documented; B is a complete visual and interaction spec. Integration
is a front-end port onto A's existing data and APIs, plus a backlog of features B shows that A doesn't have.

## 2. Integration matrix

Classes: **R** reuse existing backend · **P** port approved UI · **C** connect UI to existing API ·
**B** build missing backend · **D** defer.

| Feature | A today | B prototype | API in A | Tables | UI migration | Missing | Risk | Tests | Class |
|---|---|---|---|---|---|---|---|---|---|
| Marketing (home, features, how it works, pricing) | `/`, `/pricing` static | `/`, `/features`, `/how-it-works`, `/pricing`, hero motion scenes | none needed | — | Port pages + SVG scenes | `/features`, `/how-it-works` pages | Motion perf on low-end phones; LCP | Lighthouse, reduced-motion | P |
| Legal / contact | none | `/terms`, `/privacy`, `/contact` | contact needs a sink | — | Port | Legal copy must be real, not prototype text; contact form backend | Publishing placeholder legal text | Content review | P + D (contact form) |
| Sign-up / login / magic link | `(auth)` pages + server actions | `/signup`, `/login` | server actions | `auth.users`, `profiles` | Restyle to B | — | Breaking redirect + `?next=` + `?plan=pro` | Auth e2e, open-redirect | P + C |
| Email verification | Link-based (token_hash) | 6-digit **OTP** screen `/verify-email` | Supabase supports email OTP | — | Port screen | Switch Supabase template to `{{ .Token }}` if OTP chosen | Changing verification method breaks in-flight links | Both paths | P + C (decision §12) |
| Password reset | `/forgot-password`, `/reset-password` | Same + `/reset-password/expired` | exists | — | Port + add expired state | — | — | Reset e2e | P + C |
| Onboarding | `/onboarding` | `/onboarding` (work, goal) | exists | `profiles` | Port | `profiles` has no work/goal columns | — | — | P + C (+ small B) |
| Dashboard | Stats, plan banner, list, checklist | Cards, charts, upcoming/live/previous | page queries | `webinars`, `registrations`, `webinar_usage`, `subscriptions` | Port layout; feed real queries | Attendance rate needs attendance data (§7) | Showing invented numbers | Empty/free/pro states | P + C |
| Webinar list | In dashboard | `/webinars`, `/live`, `/upcoming`, `/previous` | `GET /api/webinars?status=` | `webinars` | Port as filtered views | — | — | Pagination | P + C |
| Create wizard | 5 steps: details, schedule, settings, form, review | 5 steps: basics, access, registration & payments, experience, review | `POST/PATCH /api/webinars` | `webinars` | Port B's wizard, map fields to A's schema | Recurring, prerecorded, paid, passcode, waitlist, reminders, invites, redirect URL | Shipping toggles that save nothing | Each step validates; draft/scheduled; 402 | P + C, rest → §7 |
| Custom registration fields | **Exists**: `custom_fields` (text, textarea, select, checkbox; max 10), validated in SQL | Builder with short, number, email, phone, dropdown, single, multi; drag reorder | exists | `webinars.custom_fields`, `registrations.answers` | Port builder UI | Types: number, email, phone, single, multi | Schema mismatch between UI and SQL validator | Each type round-trips | P + C + small B |
| Manage webinar | `/dashboard/webinars/[id]`: overview, registrations, recordings tabs | 8 tabs: overview, settings, registrations, payments, branding, reminders, offers, analytics | exists for 3 | — | Port shell + 3 real tabs | payments, branding, reminders, offers, analytics | Empty tabs that look finished | Owner-only (404 for others) | P + C, rest → §7 |
| Registrations + approval | Approve/reject/cancel, per-attendee join link | + waitlist, filters, CSV export | `GET/PATCH …/registrations` | `registrations` | Port table | Waitlist status, CSV export | — | RLS: host only | P + C (+ B for waitlist/export) |
| Public event page | `/register/[id]` (UUID) | `/e/:slug`, `/register`, `/confirmation`, `/waiting-room`, `/replay` | `get_public_webinar`, `register` | `webinars`, `registrations` | Port; add slug alias | `slug` column; waiting room | Old `/register/<uuid>` links in sent emails | Old links still resolve | P + C + small B |
| Guest join | `/join/[token]`, anonymous session, `claim_registration()` | `/invite/:token` | exists | `registrations.join_token` | Port screen onto `/join/[token]` | — | Link scanners consuming token (already click-gated) | Token reuse, revoked registrant | P + C |
| My events (attendee) | none | `/my-events` | query own registrations (RLS allows) | `registrations` | Port | Page | Guests have no stable identity across devices | — | P + C |
| Host studio | `/room/[id]` host view: stage, dock, drawer, spotlight, polls, REC | `/webinars/:id/studio`: 6 layouts, whiteboard, annotations, guest speaker, light theme | Agora + Realtime | `room_*` | Restyle A's room to B's look, panel by panel | Layouts beyond A's two, whiteboard, guest speaker (promote), co-host | Regressing live media; touching `use-broadcast.ts` | Media + realtime smoke after every panel | P on top of R |
| Practice session | none | `/webinars/:id/practice` | `start_webinar` makes it live | — | Port | Backstage state (host joins before attendees) | Plan usage counted for practice | — | B (§7) |
| Attendee room | `/room/[id]` attendee view, prejoin, mobile nav | `/live-room`, `/join`, `/ended` | exists | — | Restyle | — | Showing host controls to attendees (already role-gated) | Role check, reconnect | P on top of R |
| Chat / Q&A / polls / hands / reactions | Realtime via DB functions, rate limits, slow mode | Same features + pin/delete message, poll timer, correct answer, leaderboard | exists | `room_messages`, `room_questions`, `room_polls`, votes | Port panels | Pin/delete chat, poll extras | — | Realtime e2e | P + C (+ B for extras) |
| Attendee count / presence | Presence on `room:<id>` | Shows live counts (simulated) | exists | — | Bind to presence only | — | **Simulated viewers must never appear as real** | — | C |
| Offers / CTA on stage | none (checklist P1) | Offer cards, schedule, impressions, clicks | none | none | Port UI after backend | Everything | — | Click tracking | B → P |
| Analytics + exports | Basic counts | Attendance, watch time, engagement, CSV | none | none | Port after backend | Attendance tracking, aggregation, export | Wrong metrics | — | B → P |
| Recordings | Local (IndexedDB) list + replay by URL | Library: processing/ready/failed, visibility, expiry, rename | `…/recordings` | `recordings` | Port library; show local + linked | Visibility, expiry, rename | Implying cloud processing that doesn't exist | Access: host + approved registrant | P + C (+ small B) |
| Replay page | `/recordings/[id]` player | `/e/:slug/replay` | exists | `recordings` | Port | Expiry, CTA | — | RLS | P + C |
| Evergreen / prerecorded | none | `/evergreen`, create (7 steps), timeline | none | none | — | Everything | Large feature | — | D (§7) |
| Billing (Pro) | `/dashboard/billing`, `/upgrade`, Razorpay | `/billing`, `/billing/checkout`, `/billing/history` | subscribe/verify/cancel/webhook | `subscriptions` | Port | Invoice history (read from Razorpay) | Displaying simulated invoices | Razorpay test mode | P + C (+ small B) |
| Ticket payments + payouts | none | Paid events, checkout, `/settings/payouts` | none | none | — | Everything (Razorpay Orders, Route/linked accounts, KYC) | Regulatory + money movement | — | D (§7) |
| Branding | none | `/settings/branding`, per-webinar branding | none | none | — | Columns + storage for logo/cover | — | — | B → P |
| Email sender / ZeptoMail | Resend platform sender | `/settings/integrations` with 5 providers, region, test send | none | none | — | Encrypted credential store, provider adapters | Storing third-party secrets | — | B (§7, decision §12) |
| Notifications settings | none | `/settings/notifications` | none | none | — | Preferences table | — | — | D |
| Profile settings | none | `/settings/profile` | Supabase `updateUser` + `profiles` | `profiles` | Port | — | — | — | P + C |
| Admin console | none | `/admin/*` (users, webinars, billing, usage, support) | none | none | — | Platform-admin role, audit log | Privilege escalation | — | D |
| Prototype guide | — | `/prototype/*`, role switcher panel | — | — | **Don't port** | — | Shipping debug tools | — | — |

## 3. Route mapping

Rule: existing functional routes stay canonical. Prototype slugs become **redirects** (308, in `next.config.ts`
`redirects()`) or **new routes** where there's no equivalent. All links are relative paths; absolute URLs only
come from `getSiteUrl()` (emails, payment callbacks), which already refuses localhost when
`NEXT_PUBLIC_SITE_URL` is set. Production value: `https://webinar.deployandgrow.com`.

| Prototype route | Next.js route | Action |
|---|---|---|
| `/` `/pricing` | same | Restyle |
| `/features` `/how-it-works` `/terms` `/privacy` `/contact` | same | New static pages (add to `PUBLIC_PATHS` in `src/lib/supabase/proxy.ts`) |
| `/signup` `/login` `/forgot-password` `/reset-password` `/onboarding` | same | Restyle |
| `/verify-email`, `/reset-password/expired` | same | New pages |
| `/dashboard` | `/dashboard` | Restyle |
| `/webinars`, `/webinars/{live,upcoming,previous}` | `/dashboard/webinars?status=…` | New list page; redirects from prototype paths |
| `/webinars/create` | `/dashboard/webinars/new` | Redirect |
| `/webinars/:id/overview` | `/dashboard/webinars/[id]` | Redirect |
| `/webinars/:id/{settings,registrations,payments,branding,reminders,offers,analytics}` | `/dashboard/webinars/[id]/<tab>` | Nested routes (real URLs, so refresh and Back/Forward work) replacing in-page tabs; only built tabs appear in nav |
| `/webinars/:id/{studio,live-room,join}` | `/room/[id]` | Redirect. One room route; the server decides host vs attendee |
| `/webinars/:id/practice` | `/room/[id]?practice=1` | Later (§7) |
| `/webinars/:id/ended` | `/room/[id]` ended state | Existing end screen restyled |
| `/e/:slug` | `/e/[slug]` → same component as `/register/[id]` | New alias; `/register/[id]` stays valid forever |
| `/e/:slug/{register,confirmation,waiting-room}` | `/e/[slug]` states | One page, states driven by registration status |
| `/e/:slug/replay` | `/recordings/[id]` | Link from event page |
| `/e/:slug/checkout` | — | Deferred with ticket payments |
| `/invite/:token` | `/join/[token]` | Redirect |
| `/my-events` | `/my-events` | New (signed-in or guest session) |
| `/recordings`, `/recordings/:id` | `/dashboard/recordings`, `/recordings/[id]` | Redirect `/recordings` → dashboard; player stays |
| `/billing`, `/billing/checkout`, `/billing/history` | `/dashboard/billing`, `/upgrade`, `/dashboard/billing/history` | Redirects + new history page |
| `/settings/{profile,branding,integrations,notifications,payouts}` | `/dashboard/settings/<x>` | Profile now; others as their backends land |
| `/evergreen/*`, `/admin/*` | — | Deferred |
| `/prototype/*`, `/sample-destination` | — | Not ported |

Checks for every route: unauthenticated → `/login?next=…`; guest session on account pages → `/signup`; another
host's webinar → 404 (not 403); hard refresh works (no client-only state); no hash routes.

**Collision to watch:** `/recordings` (prototype library) vs `/recordings/[id]` (existing replay player, open to
attendees). The redirect must match `/recordings` exactly, never `/recordings/:id`.

## 4. Design system reconciliation

The two systems share a base (Geist, oklch, ivory `oklch(0.985 0.004 85)` background, same easing curve). They differ in:

`app.css` defines its tokens twice. The block at the top is overridden by a "calm premium layer" near the end of the
file (line 711). That later layer is what the approved UI shows, so those are the values ported.

| Token | Repo before | Prototype (effective) | Done |
|---|---|---|---|
| `primary` | Teal `oklch(0.5 0.095 182)` | **Muted navy** `oklch(0.42 0.065 205)` | ✅ |
| Accent | `highlight` amber | Soft `teal` `oklch(0.5 0.07 190)` + `teal-subtle` | ✅ `teal`, `teal-foreground`, `teal-subtle`; `highlight` kept as amber for attention |
| Neutrals | Warm ivory (hue 60–85) | Cool off-white (hue 230–255) | ✅ |
| Status | live/success/warning/destructive | + `*-subtle`, `warning-text` | ✅ |
| Display font | Instrument Serif | None (Geist only) | ✅ removed; `font-display` is a transitional Geist alias |
| Radius | 0.75rem scale | 6 / 8 / 14 / 18 px | ✅ mapped onto `sm/md/xl/2xl`, so no component classes changed |
| Shadows | card, elevated | xs, card, raise, pop | ✅ (`pop` → `shadow-elevated`) |
| Motion | ease-soft, ease-spring | + ease-out, ease-in-out, durations | ✅ easings; durations documented |
| Dark mode | App-wide `.dark` | `.dark` = studio/room "dark world"; app is light | Room always dark (as now); app dark mode stays available but secondary |
| Stage | warm near-black | navy near-black | Prototype |

Every shadcn primitive in `src/components/ui/` reads these tokens, so changing them restyles the app in one place.
Then the prototype's component classes are rebuilt as React components.

## 5. File-by-file plan

**Unchanged (backend we keep):** `supabase/migrations/*`, `src/lib/{api,agora,billing,email,realtime,recording,supabase,webinars}/*`,
`src/lib/{auth,env,site-url,calendar,time,format}.ts`, `src/proxy.ts`, every `src/app/api/**/route.ts`,
`src/app/auth/callback/route.ts`, `src/components/room/use-*.ts`. Edits to these only for listed features, as separate commits.

| Step | Files | Change |
|---|---|---|
| 3a Tokens | `src/app/globals.css`, `src/app/layout.tsx` | Prototype tokens; drop Instrument Serif; keep `@theme` mapping |
| 3b Brand | `src/lib/brand.ts`, `src/components/brand/logo.tsx`, `src/lib/email/templates.ts` (name only) | "Deploy & Grow Webinar" |
| 3c Primitives | `src/components/ui/{button,badge,card,input,tabs,dialog,sheet,…}.tsx` | Variants matching prototype (`btn-teal`, `btn-outline`, `b-success`, …) |
| 3d App blocks | `page-header`, `stat-card`, `empty-state`, new `components/dg/{callout,usage-banner,kv,progress-steps,section-title,ticks}.tsx` | Port prototype UI helpers (`UI.*` in `core.js`) |
| 3e Motion | new `src/components/motion-graphics/{hero,create,invite,present,engage,convert,…}.tsx` | Port `motion.js` scenes: static SVG + CSS keyframes, `IntersectionObserver` to pause offscreen, reduced-motion still frame |
| 4a Public | `src/app/page.tsx`, `pricing/page.tsx`, new `features/`, `how-it-works/`, `terms/`, `privacy/`, `contact/`, `components/marketing/*` | Port |
| 4b Auth | `src/app/(auth)/*`, new `verify-email/`, `reset-password/expired/` | Restyle; keep server actions as is |
| 4c Dashboard | `src/app/dashboard/{layout,page}.tsx`, `components/dashboard/*`, new `dashboard/webinars/page.tsx` | App shell (248 px sidebar), cards on real queries |
| 4d Wizard | `components/webinar/webinar-form.tsx` (split into `wizard/step-*.tsx`), `lib/webinars/schema.ts` (new field types) | Prototype 5-step layout on A's schema; unsupported options not shown |
| 4e Manage | `dashboard/webinars/[id]/page.tsx` → `[id]/layout.tsx` + `page.tsx` + `registrations/page.tsx` + `settings/page.tsx`, `components/webinar/*` | Tab routes |
| 4f Public event | `register/[id]/page.tsx`, `components/register/*`, new `e/[slug]/page.tsx`, `join/[token]/page.tsx`, new `my-events/page.tsx` | Port |
| 5 Room | `components/room/{room,stage,dock,prejoin,chat-panel,qna-panel,polls-panel,people-panel,poll-overlay,settings-dialog}.tsx` | Visual-only changes, one component per commit; hooks untouched |
| 6 Billing/recordings/settings | `dashboard/billing/*`, `upgrade/`, `dashboard/recordings/`, `recordings/[id]/`, `components/billing/*`, `components/dashboard/local-recordings.tsx`, new `dashboard/settings/profile/` | Port |
| Routes | `next.config.ts` (`redirects()`), `src/lib/supabase/proxy.ts` (`PUBLIC_PATHS`) | §3 |
| Not ported | `js/pages-admin.js` (`/prototype/*`, role switcher), `CONFIG.otpDemo`, `seed()`, `PEOPLE`, `localStorage`, `checkoutSheet` simulator, `api.*` mocks | — |

## 6. Backend preservation list

Verified by reading the code; re-tested after every module (§10).

| System | Where | What must keep working |
|---|---|---|
| Supabase Auth | `(auth)/actions.ts`, `auth/callback`, `lib/auth.ts`, `proxy.ts` | Password + magic link, PKCE + token_hash, `safeNextPath`, generic errors, `?plan=pro` → checkout |
| Guest sessions | `20261028000000_guest_join.sql`, `requireUser({ allowGuest })` | Anonymous register → join; guests blocked from hosting; `/join/<token>` click-gated |
| RLS | every migration | Owner-only rows; 404 for others' webinars; room tables only through functions |
| Webinar CRUD | `api/webinars/**`, `lib/webinars/*` | zod validation, `live`/`ended` server-only, typed errors |
| Plan limits | `20261027000000_plans_billing.sql` | Free: 1 webinar (advisory lock), 100 attendees (trigger), `webinar_usage`; Pro via `user_plan()`; 402/409 codes |
| Razorpay | `lib/billing/*`, `api/billing/*` | HMAC verify (constant-time), server re-reads subscription, idempotent webhook, superseded-sub guard, cancel at period end |
| Agora | `lib/agora/server.ts`, `api/…/rtc-token`, `use-broadcast.ts` | Tokens only while live, host uid 1/2 binding, approved registrants only, dual stream, auto-rejoin |
| Realtime | `20261026030000_realtime_room.sql`, `use-room.ts` | Private channels, DB-only broadcasts, rate limits, slow mode, snapshot on reconnect |
| Email | `lib/email/*`, `api/cron/emails`, `email_log` | Confirmation + .ics, 24 h / 1 h reminders, live email, exactly-once claims |
| Local recording | `lib/recording/*`, `use-recorder.ts` | Worker-timed canvas, 2 s chunks to IndexedDB, crash recovery, save dialog |

**Open configuration gaps (from `docs/implementation-checklist.md`, still open):** production env needs Agora
certificate, Razorpay keys/plan/webhook, `SUPABASE_SERVICE_ROLE_KEY`, Resend domain + `CRON_SECRET`; migration
`20261028000000_guest_join.sql` must be pushed and anonymous sign-ins enabled; pg_cron job scheduled; Supabase
Site URL / Redirect URLs must change to `https://webinar.deployandgrow.com`. **No Turnstile / CAPTCHA yet.**
I can't check the live Supabase/Vercel settings from here. Please confirm them.

## 7. Missing feature backlog

None of these is production-ready, whatever the prototype shows. Order = dependency order.

| # | Feature | Backend work | Depends on | Size |
|---|---|---|---|---|
| 1 | Bot protection (Turnstile) on register/login/sign-up | Server verify in actions + register API; per-IP rate limit | — | S |
| 2 | Event slugs (`/e/[slug]`) | `webinars.slug` unique citext, generated on create, editable | — | S |
| 3 | Extra field types (number, email, phone, single, multi) | Extend zod + `register_for_webinar` validator | — | S |
| 4 | Waitlist | `registration_status` + `waitlisted`; promote on cancel/cap raise; email | 3 | M |
| 5 | Attendance tracking | `attendance_sessions` (join/leave per registration, via DB function on presence join + heartbeat) | — | M |
| 6 | Offers / CTA | `offers`, `offer_events` (impression/click), `show_offer()` broadcast | 5 | M |
| 7 | Analytics + attendance export | Views over 5/6 + registrations; streamed CSV route (host-only). (A client-side CSV export of registrations already exists on the manage page.) | 5, 6 | M |
| 8 | Custom reminders | `reminder_schedules`; generalise `email_kind` + cron | — | M |
| 9 | Email + CSV invitations | `invitations` table, CSV parse (size/row caps), send via email pipeline, unsubscribe | 8 | M |
| 10 | Branding | `workspaces`/`brand` columns, Supabase Storage bucket with RLS | — | M |
| 11 | ZeptoMail | See §12. Platform: provider adapter. Per-workspace sender: encrypted credentials (pgsodium/Vault or app-level AES-GCM with key in env), domain verification, test send | 8 | M–L |
| 12 | Practice / backstage | `webinars.backstage` state; Agora token for host while not live; doesn't count as usage | — | M |
| 13 | Promote to speaker / co-host | `webinar_cohosts`, role in `webinar_role()`, publisher tokens for speakers | 12 | L |
| 14 | Studio extras (layouts, whiteboard, annotations, chat pin/delete, poll timer/correct answer) | Mostly client; pin/delete via DB functions | — | M |
| 15 | Recording visibility, expiry, rename | Columns on `recordings` + RLS update | — | S |
| 16 | Invoice history | Read Razorpay invoices server-side | — | S |
| 17 | Paid tickets | `orders`, `payments`; Razorpay Orders; verify + `payment.captured` webhook (separate endpoint and secret from subscriptions); registration `awaiting_payment` | 2 | L |
| 18 | Organizer payouts | Razorpay Route linked accounts, KYC, settlement reconciliation | 17 | XL, needs legal/finance |
| 19 | Evergreen / prerecorded | `evergreen_campaigns`, session generator, timeline events, hosted video storage | 6, 15 + video hosting | XL |
| 20 | Cloud recording | Agora Cloud Recording → storage, webhook, transcoding | storage choice (no AWS) | L |
| 21 | Admin console | `platform_admins`, audit log, read-only first | — | L |

## 8. Database changes required

All additive and in new migrations. No existing migration is edited.

| Migration | Contents | Needed for |
|---|---|---|
| `…_slugs.sql` | `webinars.slug` + unique index + backfill; `get_public_webinar_by_slug()` | `/e/[slug]` |
| `…_field_types.sql` | Replace `register_for_webinar` validator for new types | Wizard field builder |
| `…_profile_fields.sql` | `profiles.work`, `profiles.goal` (nullable) | Onboarding |
| `…_waitlist.sql` | `alter type registration_status add value 'waitlisted'`; promotion function | Waitlist |
| `…_attendance.sql` | `attendance_sessions` + RLS + `record_attendance()` | Analytics, honest live counts |
| `…_offers.sql` | `offers`, `offer_events` + functions | CTA |
| `…_reminders.sql` | `reminder_schedules`; `email_log.kind` → text or wider enum | Custom reminders |
| `…_recording_access.sql` | `recordings.visibility`, `expires_at` | Recordings UI |
| Later | invitations, branding/storage, cohosts, orders/payments, payouts, evergreen, admin | §7 |

## 9. Pricing rules

Both projects agree on the numbers: Free ₹0, 1 webinar, 100 attendees; Pro ₹499/month; no annual; no USD.
Prices come from `src/lib/billing/plans.ts`, and the database enforces the limits.

**Conflict to fix:** the prototype's Pro list (`PRO_BENEFITS`) sells "co-hosts, layouts, whiteboard",
"recordings and replays" and "engagement, analytics and offers" as Pro extras. That breaks this repo's rule that
both plans have every feature and differ only in limits. Most of those features also don't exist yet.

**Plan:** use the repo's honest list in the prototype's layout:
- **Free:** 1 webinar, up to 100 attendees, all live features.
- **Pro:** Everything in Free, unlimited webinars, unlimited attendees\*, run as many live sessions as you like.
- \*Keep the prototype's footnote: "Room size depends on streaming capacity."

A feature is added to either list only once it ships. If you *want* some features to be Pro-only, that's a
product decision. It needs a database entitlement check, not just copy.

## 10. Test plan per module

After every module: `tsc --noEmit`, `npm run lint`, `npm run build`, `npm run test:e2e` (API script, needs a Supabase
project), then a manual smoke test: sign up → create → register as guest → join link → go live (Agora) → chat/Q&A/poll →
record → end → replay; plus Razorpay test-mode upgrade/cancel, phone width (390 px), keyboard-only, and reduced motion.
Before public release: load tests at 50, 80 and 100 attendees (Agora audience + Supabase Realtime connections and
message rate; Supabase Pro plan required for >200 concurrent).

## 11. Risks

| Risk | Mitigation |
|---|---|
| Room regressions during restyle (media/realtime are stateful and hard to test) | Room is ported last of the core screens; hooks (`use-*.ts`) untouched; one component per commit; manual live test each time |
| Prototype implies features exist (empty tabs, toggles that save nothing) | Only render controls whose backend exists; backlog items stay out of nav until shipped |
| Simulated data leaking into prod | No seed data ported; any demo mode is behind `NODE_ENV !== "production"` and labelled |
| Broken old links (`/register/<uuid>`, `/join/<token>` in sent emails) | Never remove these routes; new slugs are aliases |
| Auth redirect to localhost on new domain | `getSiteUrl()` already guards; Supabase Site URL + Redirect URLs must be updated (config, not code) |
| Colour change hurts contrast | Check text/background pairs against WCAG AA after token swap |
| Motion cost on phones | Transform/opacity only, pause offscreen, reduced-motion stills, no JS per frame |
| Next.js 16 API differences | Read `node_modules/next/dist/docs/` before touching routing/caching (per `AGENTS.md`) |
| Paid tickets / payouts | Separate design, endpoint, secret and tables from subscriptions; deferred until the rest is stable |

## 12. Decisions (agreed 2026-10-28)

1. **Email provider: option C.** Resend stays the platform sender (auth SMTP, confirmations, reminders, live
   emails). ZeptoMail is built only as the coach's optional custom sender (backlog item 11): encrypted credentials,
   verified sender domain, test send, then per-workspace sending with Resend as fallback.
2. **Email verification:** keep the existing confirmation link. A secure 6-digit OTP is a later phase (server-side
   expiry, attempt limits, Supabase `{{ .Token }}` template). Until then `/verify-email` is a "check your inbox" screen,
   not a code entry form.
3. **Colours and fonts:** muted navy primary + soft teal accent, Geist only.
4. **Brand:** Onstage → Deploy & Grow Webinar.

## 13. Recommended sequence

| Phase | Work | Exit check |
|---|---|---|
| 1 | Tokens, brand, primitives, app blocks, motion scenes | Build green; every existing page still renders |
| 2 | Public pages + auth screens + redirects | Auth e2e; old URLs resolve |
| 3 | Dashboard shell, webinar list, wizard, manage tabs (real data only) | CRUD + 402 path + RLS 404 |
| 4 | Public event page (+ slug), join, my events | Guest register → join |
| 5 | Room restyle (studio + attendee), panel by panel | Live session test |
| 6 | Billing, recordings, profile settings | Razorpay test mode; recording recovery |
| 7 | Backlog in §7 order, each with migration + tests | Per feature |
| 8 | Security pass (Turnstile, rate limits, RLS review), perf, load tests 50/80/100 | Release gate |

## 14. Progress log

### Phase 1 (2026-10-28): design system, components, motion graphics
Tokens, brand, primitives, app blocks and all prototype motion scenes ported; dev gallery at `/dev/ui`
(404 in production). See `docs/design-system.md`.

### Phase 2 (2026-10-28): public pages, auth UI, aliases
- **Pages:** `/`, `/features`, `/how-it-works`, `/pricing` in `src/app/(marketing)` with the prototype's header,
  footer and sections. Scenes: hero (landing), journey (landing, how it works), feature demos (landing, features).
- **Honest copy:** prototype features that aren't built (paid tickets, offers, automated webinars, analytics,
  co-hosts, layouts, six-digit codes) are labelled "Coming soon" or left out. Plan lists come from `plans.ts`.
- **Auth:** prototype layout and form styling on the existing Supabase actions. Added `/verify-email` (resend
  confirmation link via `supabase.auth.resend`) and an expired-link view. Magic-link sign-in kept. No OTP.
- **Aliases** (307, `next.config.ts`): `/invite/:token`, `/webinars/create`, `/billing`, `/billing/checkout`,
  `/recordings` (exact). `/register/:id`, `/join/:token` and every existing route are unchanged.
- **Not done yet:** Terms, Privacy and Contact pages (need real legal text and a contact inbox), onboarding restyle
  (Phase 3), `/e/:slug` event aliases (need the `slug` migration).

### Phase 3 (2026-10-28): app shell, dashboard, onboarding, wizard, manage page
- **Shell** (`components/dashboard/app-shell.tsx`): 248 px sidebar with grouped nav and a plan box from
  `get_my_plan`, sticky top bar, sheet navigation under 1024 px. Same routes and `requireUser()` checks.
- **Dashboard** (`components/dashboard/dashboard-view.tsx`): one primary action and a next-step line derived from
  real webinars; Free usage bar; setup checklist + lifecycle scene for new accounts; stat cards from real counts
  only (no attendance/revenue until that data exists); restyled webinar list (same delete/copy behaviour).
- **Onboarding**: prototype three-step flow. Answers saved with `supabase.auth.updateUser` on the account's
  own metadata (`onboarding_work`, `onboarding_goal`); no schema change.
- **Wizard**: prototype layout (step list, scene, progress, sticky footer); steps, validation and API calls unchanged.
- **Manage page** (`components/webinar/manage-view.tsx`): header, next step, callouts, stat/section cards, line tabs.
  Tabs stay in-page; per-tab routes deferred.
- **Previews**: `/dev/ui/dashboard?state=…`, `/dev/ui/onboarding`, `/dev/ui/wizard`, `/dev/ui/manage` render the real
  components with labelled sample props (404 in production), because the real pages need a Supabase session.

## 15. Production readiness backlog (pending)

| Item | Status |
|---|---|
| Real Supabase authentication and email verification testing (sign-up, confirm, sign-in, magic link, reset, resend) | Pending: needs configured Supabase credentials |
| Razorpay test-mode checkout (subscribe, verify, webhook, cancel) | Pending |
| Agora live webinar verification (host publish, screen share, attendee view, reconnect) | Pending |
| Real mobile-device testing (iOS Safari, Android Chrome) | Pending: only headless Chromium-based checks so far |
| Terms, Privacy and Contact pages | Pending: need real legal text and a support address from the owner |
| Bot protection (Turnstile on register, login, sign-up; then Supabase CAPTCHA) | Pending |
| Production environment configuration checks (Supabase Site URL / Redirect URLs, Vercel env, Agora certificate, Razorpay keys + webhook, Resend domain, `CRON_SECRET`, pg_cron job) | Pending |
