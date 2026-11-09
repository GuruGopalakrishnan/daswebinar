# Staging runbook: event-slug migration and Phase 4 verification

**Scope:** a separate Supabase **staging** project only. Nothing here touches production. Production needs a separate,
explicit approval after staging passes.

## 0. What you need

| Item | Where it goes | Never |
|---|---|---|
| A new, empty Supabase project for staging (not the production project) | Supabase dashboard | Reuse the production project |
| A Supabase access token (`npx supabase login`, opens the browser) | Supabase CLI's own store on your machine | Paste it in chat or commit it |
| The staging database password | Typed when the CLI asks, or `SUPABASE_DB_PASSWORD` in your shell | Commit it |
| Staging URL, publishable key (`sb_publishable_…`), secret key (`sb_secret_…`) from Settings → API Keys | `.env.staging.local` (gitignored by `.env*`) | Put staging keys in `.env.local`, print them, or commit them |

Staging settings to match production: **Authentication → Sign In / Providers → Allow anonymous sign-ins: on**.
**Authentication → URL Configuration**: Site URL = the staging app URL (or `http://localhost:3123` for a local build),
Redirect URLs include `<that URL>/**`.

## 1. Confirm the target is staging

```bash
npx supabase projects list                     # find the staging ref; production must be a different ref
npx supabase link --project-ref <STAGING_REF>  # links this folder to staging
cat supabase/.temp/project-ref                 # must print <STAGING_REF>
```

Stop if the printed ref is the production project.

## 2. Review migration history

```bash
npx supabase migration list --linked
```

A **new** staging project shows all eight local migrations with an empty "Remote" column. Expected local files:

```
20261026000000_profiles            20261027000000_plans_billing
20261026010000_webinars            20261028000000_guest_join
20261026020000_fields_lifecycle_recordings
20261026030000_realtime_room       20261029000000_email_notifications
                                   20261030000000_event_slugs   (Phase 4, new)
```

Stop if the remote lists anything that isn't in this folder, or local and remote disagree on an applied version.

**Future-dated names.** `20261029000000_email_notifications` was already in the repo before this work (committed
2026-10-27, dated two days ahead); `20261030000000_event_slugs` follows it. Both sort correctly. Until 2026-10-30,
`supabase migration new` would create a timestamp that sorts *before* them, which `db push` refuses (or applies out of
order with `--include-all`). Until then, name any new migration by hand with a later version (e.g. `20261030010000_…`).
Don't rename the email migration: production may already record it by that version.

## 3. Dry run

```bash
npx supabase db push --linked --dry-run
```

Expected on a new staging project: the eight migrations above, in that order, and nothing else. The only statements in
`20261030000000_event_slugs.sql` that change existing objects are `alter table public.webinars add column slug`, a
temporary `disable/enable trigger user` around the backfill, `set not null`, a check constraint and a unique index.
There are no `drop` statements in it. Stop and report if the dry run lists anything else.

## 4. Apply to staging

```bash
npm run test:db                      # 42 PGlite checks must pass first
npx supabase db push --linked        # staging only (see step 1)
npx supabase migration list --linked # all eight now show a Remote version
```

## 5. Verify

```bash
# 1. Add <STAGING_REF> to APPROVED_STAGING_REFS in scripts/staging-guard.mjs (reviewed commit).
# 2. .env.staging.local: STAGING_SUPABASE_URL, STAGING_SUPABASE_PUBLISHABLE_KEY (sb_publishable_...),
#    STAGING_SUPABASE_SECRET_KEY (sb_secret_..., server-side only), optional STAGING_PROJECT_REF and STAGING_APP_URL
npm run test:staging-guard
node scripts/staging-check.mjs --approved-ref=<STAGING_REF>
```

It fails closed, and it checks everything before it creates any test data:

1. **Local checks.** `--approved-ref`, `APPROVED_STAGING_REFS`, the linked project (`supabase/.temp/project-ref`) and
   the URL must name the same project. It always refuses the production project (`xktlibiflgzsuonutsxe`) and
   `rplbnqpbdanqhnugzyxy`, which stays protected until its dependants are verified. The keys must have the
   `sb_publishable_` / `sb_secret_` format (legacy JWT keys are refused). The app's own env files (`.env`, `.env.local`,
   `.env.production*`) must not contain the ref or either key.
2. **Key ownership.** Publishable and secret keys don't say which project they belong to, so the script proves it
   with two read-only requests, sent only to `https://<STAGING_REF>.supabase.co` and only after step 1 passes:
   `GET /auth/v1/settings` with the publishable key, and `GET /auth/v1/admin/users?page=1&per_page=1` with the secret
   key. Supabase rejects a key from any other project with 401, so both must return 200. Any other status, a redirect,
   a timeout or a network error stops the run. Only the status code is read: each response body is cancelled without
   being read, parsed or logged, and key values never appear in output. A 200 from the admin endpoint does mean the
   server sent back up to one user record from the staging project; the script discards it unread.

Limitation: the ownership proof needs network access and relies on Supabase's gateway rejecting other projects' keys.
If a key is wrongly copied from another project, it is sent to the staging host (over HTTPS, to Supabase only) before
being rejected; the env-file check in step 1 catches the app's own keys before any request.

It creates test users (`@example.com`, created confirmed so no email is sent), webinars and registrations tagged with
the run id, checks the rules, and deletes only rows it can re-confirm it created.

To include the app's HTTP checks (`/e/…` 404s, `/register/…`, `/join/…`), run a build pointed at staging in another
terminal and set `STAGING_APP_URL=http://127.0.0.1:3123`:

```bash
NEXT_PUBLIC_SUPABASE_URL=<staging url> NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging publishable key> \
NEXT_PUBLIC_SITE_URL=http://localhost:3123 npm run build && npx next start -p 3123
```

### Manual checks (need a real inbox)

The script can't receive email. With Resend configured for staging, register with a real inbox and check:

1. Sign up with a real address → the confirmation email arrives → its link signs you in and lands on `/onboarding`.
2. Register for a public webinar as a guest → the confirmation email arrives with a calendar file and `/join/<token>`.
3. Open that join link on another device → Enter the waiting room → the pre-join screen.
4. The host rejects the registration → the same link now says the registration isn't active.
5. Password reset email → link → new password → dashboard. An old or reused reset link → "This reset link has expired".

## 6. Rollback and recovery (staging)

- **Undo the slug migration only:** run `supabase/rollbacks/20261030000000_event_slugs.down.sql` in the staging SQL
  editor, then delete its history row: `delete from supabase_migrations.schema_migrations where version = '20261030000000';`.
  Webinar ids, registrations and join tokens are untouched; `/register/<id>` and `/join/<token>` keep working.
- **Start over:** staging is disposable. Delete the project, create a new one and repeat from step 1.
- The app works before and after the rollback (slug links 404, My events says "not available yet").

Production stays untouched throughout.
