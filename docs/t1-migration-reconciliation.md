# T1: Migration reconciliation (investigation)

Status: **investigation complete. Waiting for read-only results from production and staging.** No migration state
is assumed until those results are in.

Nothing was changed while preparing this:
- no application code or migration file was changed;
- no SQL was run against production or staging;
- no `db push` or `migration repair` was run;
- no branch was merged or deleted.

Files:
- `supabase/checks/t1_readonly_report.sql`: **for the Supabase SQL Editor** (works on a phone). One SELECT, one text cell.
- `supabase/checks/t1_readonly_checks.sql`: detailed version for `psql` (one result set per block).

## 1. Histories

| | `origin/main` | `origin/phase-7-webinar-room` (`366ccb7`) | `feature/deploy-grow-ui-integration` |
|---|---|---|---|
| Fork point | — | `18b71bc` (main) | `18b71bc` (main) |
| 20261026000000 … 20261029000000 (7 files) | ✔ | ✔ byte-identical | ✔ byte-identical |
| **20261030000000** | — | `_panelists_practice.sql` (501 lines, sha256 `9640671e…`) | `_event_slugs.sql` (168 lines, sha256 `79760bfe…`) |
| Rollback file | — | **none** | `supabase/rollbacks/20261030000000_event_slugs.down.sql` |

Neither branch's documentation records an applied 20261030000000:
- The panelists branch checklist has "Apply the migration to the Supabase project" unchecked.
- This branch's docs say the slug migration is not applied anywhere.

All three branches also show "Apply `20261028000000_guest_join.sql`" unchecked, so a project may even be behind
20261028. **Documentation is not evidence. The database results decide.**

## 2. The two migrations compared

| | event_slugs | panelists_practice |
|---|---|---|
| New tables | none | `room_participants` |
| `webinars` columns | `slug` (+ unique index, format check) | `practice_started_at` |
| Other table changes | none | `room_messages` / `room_questions`: author_role check widened to include `panelist` |
| New functions | `slugify`, `next_webinar_slug`, `webinars_slug_guard`, `get_public_webinar_by_slug`, `list_my_registrations` | `room_member_role`, `room_participant_json`, `get_room_access`, `set_room_panelist`, `request_to_speak`, `drop_participant_on_revoke`, `set_practice_mode`, `clear_practice_on_status` |
| **Replaced** existing functions | none | `room_settings_json`, `get_room_snapshot`, `send_room_message`, `ask_question` |
| Triggers | `webinars_slug_guard` | `webinars_clear_practice`, `registrations_drop_participant` |
| Data changes | backfills `slug` on every webinar (user triggers disabled briefly; `ACCESS EXCLUSIVE` lock on `webinars`) | none |

**No shared object names.** Both touch `public.webinars`, but different columns and different triggers.

**Order-independence experiment** (in-memory PGlite only, never a real database). The 7 base migrations plus
existing data were applied, then the two migrations in both orders. **26/26 checks passed** (13 per order).

The checks covered:
- the existing webinar backfilled with a slug, and the existing registration preserved;
- slug lookup and My events working;
- practice mode and promote-to-panelist working;
- the snapshot carrying the panelist role and participants;
- a new webinar getting the next slug, and the slug staying immutable;
- going live clearing practice mode;
- all six `webinars` triggers coexisting;
- **the slug rollback removing only slug objects and leaving the panelists objects and the data intact**.

**Compatibility:** the replaced room functions only add JSON keys (`participants`, `settings.practice`), which this
branch's client ignores. This still needs a staging smoke test.

## 3. Supabase CLI behaviour that matters

- `supabase db push` matches local files to `supabase_migrations.schema_migrations` **by version only**, never by
  name or contents. If the remote's `20261030000000` holds panelists, a local slug file with the same version is
  **silently skipped**.
- If the remote has a version with no local file, `db push` stops and suggests
  `supabase migration repair --status reverted <version>`. **Never run a suggested repair without approval**: it
  rewrites history and can hide what is really in the database.
- A local version older than the newest remote one needs `--include-all`.
- A history row is not proof the objects exist (manual drops, failed runs, repairs). Objects can also exist with no
  history row (applied through the SQL editor). That is why the checks look at both.

## 4. Security review of the read-only SQL

Reviewed 2026-11-22 before committing.

| Check | Result |
|---|---|
| Writes | **None.** Only `SELECT` against system catalogs, `information_schema`, `pg_policies`, the migration history and `count(*)` / `max(char_length(title))` on `public.webinars`. A static scan found no `insert`, `update`, `delete`, DDL, `grant`, `copy`, `set`, `do` or `call` outside comments and string literals. The psql version also wraps everything in `begin transaction … read only` … `rollback` |
| Dynamic SQL | `query_to_xml` runs only **constant** query strings; the one `format('%I')` uses a constant table list. No user input, so no injection |
| Secrets | None returned. **Fixed in review:** the first draft printed the first 80 characters of each history row's SQL (a past push could have contained anything) plus an md5. Both were replaced by a fixed label: `event_slugs` / `panelists_practice` / `other`. The first draft also listed pg_cron jobs; that block is removed (the job command can contain `CRON_SECRET`, and jobs aren't needed for T1) |
| Function bodies | `pg_get_functiondef` is used only inside `LIKE` checks; bodies are never output |
| Personal data | None. `auth.users`, emails, names, titles, join tokens and registrations content are never selected |
| Business data | The report shows the **number of webinars**, which sizes the slug backfill. The psql version's row counts (block 5, including subscriptions = number of paying customers) are a **keep-it-yourself baseline** and are not sent |
| Failure mode | Optional objects are guarded, so missing tables or columns give "absent" / NULL instead of an error |
| Tested | Both files ran against 8 simulated states in PGlite inside a read-only transaction (clean; panelists applied; slugs applied; history without objects; objects without history; partial drift plus a manual table; no history table; old CLI history without name/statements). Every state was classified correctly and nothing was written |

## 5. Running the check on a phone (Supabase SQL Editor)

Do this once for **production** and once for **staging** (and once for any other Supabase project this app was
ever linked to).

1. **Get the SQL.** On your phone, open GitHub → repository `daswebinar` → branch
   `feature/deploy-grow-ui-integration` → `supabase/checks/t1_readonly_report.sql`. Tap **Raw**, then select all
   and copy.
2. **Open the right project.** Go to `supabase.com/dashboard` and sign in. Open the project and check its name, and
   the project ref in the address bar, so you know whether it's production or staging.
3. **Open the SQL Editor.** Tap the menu (☰) → **SQL Editor** → **New query** (or **+**).
4. **Paste and check.** Paste the SQL. The query should start with `-- T1 migration reconciliation: READ-ONLY report`
   and end with `select string_agg(line, …) as report from lines;`. If you see anything else, don't run it.
5. **Run it.** Tap **Run**. You shouldn't see a "destructive operation" warning; if you do, stop and tell me.
6. **Copy the result.** The result is **one row with one cell named `report`**. Tap the cell and copy its text. If
   copying is awkward on the phone, take screenshots of the whole cell instead (you may need to open the cell or
   scroll).
7. **Send it back.** Send the text or screenshots, labelled "production" or "staging".
8. **Optional:** delete the saved query snippet from the SQL Editor afterwards. Running it changed nothing.

### What to send back

Only the `report` cell. It starts with `T1 READ-ONLY REPORT v1` and ends with `END`, and contains:

- the Postgres version;
- whether the migration history table exists;
- every history row (version, name, and a label: `event_slugs`, `panelists_practice` or `other`);
- for each of the 9 migrations, whether its objects are present (`ALL`, `SOME` with what's missing, or `NONE`);
- names of unexpected tables or functions in `public`;
- whether `email_log` / `room_participants` exist;
- the number of webinars and the longest title length (a number, not the title);
- which of `pg_cron`, `pg_net`, `pgcrypto`, `citext` are installed.

**Never send:**
- connection strings, database passwords, API keys or service-role keys;
- screenshots of Project Settings → API / Database;
- any other query results.

None of these are needed.

### Using psql instead (optional, desktop)

```bash
PGOPTIONS='-c default_transaction_read_only=on' psql "<connection string>" -v ON_ERROR_STOP=1 -f supabase/checks/t1_readonly_checks.sql
```

Send back blocks 0–4, 6 and 7. Keep block 5 (row counts) yourself; you'll compare against it after any future change.

## 6. How the results will be classified

| # | History (`20261030000000`) | Objects | Meaning |
|---|---|---|---|
| S1 | none | slugs NONE, panelists NONE | Neither migration was ever applied |
| S2 | `panelists_practice` | panelists ALL | The panelists branch was pushed |
| S3 | `event_slugs` | slugs ALL | This branch's slug migration was pushed |
| S4 | present | its objects NONE | History says applied, objects missing |
| S5 | none | one set ALL | Applied by hand (SQL editor), no history |
| S6 | any | SOME | Partial / drifted schema |
| S7 | — | an earlier migration NONE or SOME | The project is behind 20261029 (for example guest_join) |
| S8 | any | both sets present | Both applied, one or both by hand |
| S9 | history table ABSENT | — | Everything was applied by hand |

Production and staging may be in different states. Each gets its own classification.

## 7. Candidate reconciliation strategies (chosen only after the results)

| State | Strategy | Writes to a real project? |
|---|---|---|
| S1 | Repo-only: rename this branch's unapplied slug migration to a new unique version (e.g. `20261118000000_event_slugs.sql`, plus its rollback file). Panelists gets its own new version when integrated (T21), so no environment ever sees two files with one version | No (until the normal, separately approved push) |
| S2 | Keep `20261030000000` for panelists. Add a byte-identical copy of the panelists file to this branch (schema only) so the history matches; move slugs to a new version. Staging room smoke test against the panelists functions | No for T1 |
| S3 | Keep slugs at `20261030000000`; panelists gets a new version at integration | No |
| S4 | Find out why; with approval and a backup, correct the history only (`repair --status reverted`) so it matches reality, then treat as S1 | **Yes**, history only, approval required |
| S5 | Compare full function bodies with the file; if identical, with approval, `repair --status applied` with the matching file in the repo, then S2/S3. If not identical, S6 | **Yes**, history only, approval required |
| S6 | New idempotent forward-fix migration (new version) restoring missing objects; never a repair to hide drift | **Yes**, schema, approval required |
| S7 | Apply the missing earlier migrations on staging first, then production, before any Phase 7 migration | **Yes**, schema, approval required |
| S8 | Combine S2/S3 by what the history says (both sets are proven to coexist) | Depends |
| S9 | Verify every object, then, with approval, record the history for each verified version before the first CLI push | **Yes**, history only, approval required |

## 8. Risks

| Risk | Mitigation |
|---|---|
| Slugs silently skipped because the version is taken | Unique versions (guard script proposed); re-check objects after any push |
| Running the CLI's suggested `migration repair` | Only with approval, after the object checks show what really exists |
| Renaming a migration that some project already applied (re-run fails on `add column slug`) | Check every linked project first; S3 path if found |
| Slug backfill locks `webinars` briefly (`ACCESS EXCLUSIVE`) | Sized by the webinar count; low-traffic window; no live webinars during a push |
| Panelists replaces 4 room functions this branch calls (S2) | PGlite compatibility passes; staging room smoke test first |
| Body-marker checks are heuristic | Before any repair, compare full function definitions with the repo files |
| A project behind 20261029 (S7) | Shown by the report; fixed before Phase 7 migrations |

## 9. Rollback approach

- **Repo rename:** `git revert`. No database effect.
- **Slug migration:** the existing tested rollback file. It removes only slug objects; webinars, registrations and join
  tokens are untouched, and `/register/<id>` and `/join/<token>` keep working. Then delete its history row (approval required).
- **Panelists migration:** no rollback file exists. Reversing it means:
  - restoring 4 function bodies;
  - narrowing two constraints (this fails if panelist-authored rows exist);
  - dropping `room_participants`.

  Write and test one at integration (T21).
- **History repairs:** reversible with the opposite `--status`. Archive the report before and after.
- **Before any production write:** confirm PITR or a recent backup, and keep the block 5 baseline counts.

## 10. Verification checklist

Now (owner, read-only):
- [ ] Run `t1_readonly_report.sql` on production → send the `report` cell
- [ ] Run it on staging → send the `report` cell
- [ ] Run it on any other project ever linked to this app
- [ ] Confirm backups / PITR for production (Project Settings → Database → Backups)

After the results (Claude, no database access):
- [ ] Classify each project (S1–S9)
- [ ] Recommend the strategy, with data and downtime risks
- [ ] List the exact repo changes
- [ ] **Wait for approval**

After approval (later steps, each approved separately):
- [ ] Repo change; `test:db` + order-independence test + migration guard pass
- [ ] Staging: `db push --dry-run` lists exactly the expected files → push → re-run the report: objects ALL, data
  baseline unchanged, every webinar has a slug → app smoke test
- [ ] Production: the same, in a maintenance window with no live webinars, report archived before and after
