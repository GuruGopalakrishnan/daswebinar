-- T1 migration reconciliation: READ-ONLY detailed checks (psql version, one result set per block).
-- For the Supabase SQL Editor (including on a phone) use t1_readonly_report.sql instead: the editor shows only the
-- last statement's result, and that file is a single SELECT returning one text cell.
--
-- Safe to run on production: every statement is a SELECT against catalogs or the migration history, inside a
-- READ ONLY transaction that is rolled back. It returns no secrets and no personal data: no emails, names, titles,
-- keys, cron commands, function bodies or migration SQL text (history rows are classified, not printed).
--
-- Recommended: psql with read-only enforced at the session level as well:
--   PGOPTIONS='-c default_transaction_read_only=on' psql "<connection string>" -v ON_ERROR_STOP=1 -f supabase/checks/t1_readonly_checks.sql
-- Send back the results of blocks 0-4, 6 and 7. Keep block 5 (row counts) yourself as a baseline.
--
-- Queries that depend on optional objects (history columns, email_log, room_participants) are guarded,
-- so a missing object returns NULL instead of aborting the transaction.

begin transaction isolation level repeatable read read only;

-- 0. Context ---------------------------------------------------------------------------------------------------
select current_database() as database, current_setting('server_version') as postgres_version,
       current_setting('transaction_read_only') as read_only, now() as checked_at;

-- 1. Does the CLI history table exist, and which columns does it have? ----------------------------------------
select to_regclass('supabase_migrations.schema_migrations') as history_table;
select column_name, data_type
from information_schema.columns
where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'
order by ordinal_position;

-- 2. Migration history. Version only: works with every CLI version. ---------------------------------------------
select (xpath('/row/version/text()', r))[1]::text as version
from unnest(xpath('/table/row', query_to_xml(
  case when to_regclass('supabase_migrations.schema_migrations') is not null
  then 'select version from supabase_migrations.schema_migrations order by version'
  else 'select null::text as version where false' end, true, false, ''))) as r;

-- 2b. History with name and a classification of each row's first statement (guarded: returns nothing if the
--     name/statements columns don't exist). The SQL text itself is never returned, only a label:
--       event_slugs         first statement creates public.slugify          (feature/deploy-grow-ui-integration)
--       panelists_practice  first statement creates public.room_participants (phase-7-webinar-room)
--       other               anything else
select (xpath('/row/version/text()', r))[1]::text         as version,
       (xpath('/row/name/text()', r))[1]::text            as name,
       (xpath('/row/statement_count/text()', r))[1]::text as statement_count,
       (xpath('/row/kind/text()', r))[1]::text            as first_statement_kind
from unnest(xpath('/table/row', query_to_xml(
  case when (select count(*) from information_schema.columns
             where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'
               and column_name in ('name', 'statements')) = 2
  then $q$select version, coalesce(name, '') as name, coalesce(array_length(statements, 1), 0) as statement_count,
              case when statements[1] ilike '%public.slugify%' then 'event_slugs'
                   when statements[1] ilike '%public.room_participants%' then 'panelists_practice'
                   else 'other' end as kind
       from supabase_migrations.schema_migrations order by version$q$
  else 'select null::text as version where false' end, true, false, ''))) as r;

-- 3. Actual schema objects per migration. A version in history is NOT proof: this checks what really exists.
--    Function checks use a body marker, so they show WHICH version of a replaced function is live.
with fn as (
  select p.proname, pg_get_functiondef(p.oid) as def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
),
col as (
  select table_name, column_name from information_schema.columns where table_schema = 'public'
),
trg as (
  select t.tgname, c.relname from pg_trigger t join pg_class c on c.oid = t.tgrelid where not t.tgisinternal
),
checks(migration, object, present) as (
  values
  -- 20261026000000_profiles
  ('20261026000000_profiles', 'table public.profiles', to_regclass('public.profiles') is not null),
  ('20261026000000_profiles', 'trigger on_auth_user_created', exists (select 1 from trg where tgname = 'on_auth_user_created')),
  -- 20261026010000_webinars
  ('20261026010000_webinars', 'table public.webinars', to_regclass('public.webinars') is not null),
  ('20261026010000_webinars', 'table public.registrations', to_regclass('public.registrations') is not null),
  ('20261026010000_webinars', 'type public.webinar_status', to_regtype('public.webinar_status') is not null),
  ('20261026010000_webinars', 'trigger webinars_guard_status', exists (select 1 from trg where tgname = 'webinars_guard_status')),
  -- 20261026020000_fields_lifecycle_recordings
  ('20261026020000_fields_lifecycle_recordings', 'table public.recordings', to_regclass('public.recordings') is not null),
  ('20261026020000_fields_lifecycle_recordings', 'column webinars.custom_fields', exists (select 1 from col where table_name = 'webinars' and column_name = 'custom_fields')),
  ('20261026020000_fields_lifecycle_recordings', 'column registrations.answers', exists (select 1 from col where table_name = 'registrations' and column_name = 'answers')),
  -- 20261026030000_realtime_room
  ('20261026030000_realtime_room', 'table public.room_messages', to_regclass('public.room_messages') is not null),
  ('20261026030000_realtime_room', 'table public.room_polls', to_regclass('public.room_polls') is not null),
  ('20261026030000_realtime_room', 'function webinar_role', exists (select 1 from fn where proname = 'webinar_role')),
  ('20261026030000_realtime_room', 'policy realtime.messages "room: members can receive"', exists (select 1 from pg_policies where schemaname = 'realtime' and tablename = 'messages' and policyname = 'room: members can receive')),
  ('20261026030000_realtime_room', 'column webinars.slow_mode_seconds', exists (select 1 from col where table_name = 'webinars' and column_name = 'slow_mode_seconds')),
  -- 20261027000000_plans_billing
  ('20261027000000_plans_billing', 'table public.subscriptions', to_regclass('public.subscriptions') is not null),
  ('20261027000000_plans_billing', 'table public.webinar_usage', to_regclass('public.webinar_usage') is not null),
  ('20261027000000_plans_billing', 'function user_plan', exists (select 1 from fn where proname = 'user_plan')),
  ('20261027000000_plans_billing', 'trigger webinars_enforce_plan_limit', exists (select 1 from trg where tgname = 'webinars_enforce_plan_limit')),
  ('20261027000000_plans_billing', 'trigger registrations_enforce_cap', exists (select 1 from trg where tgname = 'registrations_enforce_cap')),
  ('20261027000000_plans_billing', 'start_webinar body has plan_webinar_limit', exists (select 1 from fn where proname = 'start_webinar' and def like '%plan_webinar_limit%')),
  ('20261027000000_plans_billing', 'get_public_webinar body has webinar_attendee_limit', exists (select 1 from fn where proname = 'get_public_webinar' and def like '%webinar_attendee_limit%')),
  ('20261027000000_plans_billing', 'end_webinar body has is_recording', exists (select 1 from fn where proname = 'end_webinar' and def like '%is_recording%')),
  -- 20261028000000_guest_join
  ('20261028000000_guest_join', 'column registrations.join_token', exists (select 1 from col where table_name = 'registrations' and column_name = 'join_token')),
  ('20261028000000_guest_join', 'function claim_registration', exists (select 1 from fn where proname = 'claim_registration')),
  ('20261028000000_guest_join', 'register_for_webinar body has is_anonymous_caller', exists (select 1 from fn where proname = 'register_for_webinar' and def like '%is_anonymous_caller%')),
  ('20261028000000_guest_join', 'policy "webinars: guests can''t create"', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'webinars' and policyname = 'webinars: guests can''t create')),
  -- 20261029000000_email_notifications
  ('20261029000000_email_notifications', 'type public.email_kind', to_regtype('public.email_kind') is not null),
  ('20261029000000_email_notifications', 'table public.email_log', to_regclass('public.email_log') is not null),
  -- 20261030000000_event_slugs (feature/deploy-grow-ui-integration)
  ('20261030000000_event_slugs', 'column webinars.slug', exists (select 1 from col where table_name = 'webinars' and column_name = 'slug')),
  ('20261030000000_event_slugs', 'index webinars_slug_key', to_regclass('public.webinars_slug_key') is not null),
  ('20261030000000_event_slugs', 'trigger webinars_slug_guard', exists (select 1 from trg where tgname = 'webinars_slug_guard')),
  ('20261030000000_event_slugs', 'function get_public_webinar_by_slug', exists (select 1 from fn where proname = 'get_public_webinar_by_slug')),
  ('20261030000000_event_slugs', 'function list_my_registrations', exists (select 1 from fn where proname = 'list_my_registrations')),
  -- 20261030000000_panelists_practice (phase-7-webinar-room)
  ('20261030000000_panelists_practice', 'table public.room_participants', to_regclass('public.room_participants') is not null),
  ('20261030000000_panelists_practice', 'column webinars.practice_started_at', exists (select 1 from col where table_name = 'webinars' and column_name = 'practice_started_at')),
  ('20261030000000_panelists_practice', 'function get_room_access', exists (select 1 from fn where proname = 'get_room_access')),
  ('20261030000000_panelists_practice', 'trigger webinars_clear_practice', exists (select 1 from trg where tgname = 'webinars_clear_practice')),
  ('20261030000000_panelists_practice', 'trigger registrations_drop_participant', exists (select 1 from trg where tgname = 'registrations_drop_participant')),
  ('20261030000000_panelists_practice', 'send_room_message body has room_member_role', exists (select 1 from fn where proname = 'send_room_message' and def like '%room_member_role%')),
  ('20261030000000_panelists_practice', 'room_settings_json body has ''practice''', exists (select 1 from fn where proname = 'room_settings_json' and def like '%''practice''%')),
  ('20261030000000_panelists_practice', 'room_messages author_role allows panelist', exists (select 1 from pg_constraint where conname = 'room_messages_author_role_check' and pg_get_constraintdef(oid) like '%panelist%'))
)
select migration, object, present from checks order by migration, object;

-- 4. Objects in public that no migration in either branch creates (signs of manual SQL-editor changes). ----------
select 'table' as kind, c.relname as name
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
  and c.relname not in ('profiles', 'webinars', 'registrations', 'recordings', 'room_messages', 'room_questions',
                        'room_question_upvotes', 'room_polls', 'room_poll_votes', 'subscriptions', 'webinar_usage',
                        'email_log', 'room_participants')
union all
select 'function', p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname not in (
    'set_updated_at', 'handle_new_user', 'guard_webinar_status', 'get_public_webinar', 'register_for_webinar',
    'start_webinar', 'end_webinar', 'webinar_role', 'room_topic_role', 'room_fail', 'room_display_name',
    'room_clean_text', 'room_broadcast', 'room_settings_json', 'room_message_json', 'room_question_json',
    'room_poll_json', 'get_room_snapshot', 'send_room_message', 'ask_question', 'toggle_question_upvote',
    'create_poll', 'vote_poll', 'close_poll', 'update_room_settings', 'lower_room_hand', 'broadcast_webinar_status',
    'user_plan', 'plan_attendee_cap', 'webinar_attendee_limit', 'get_my_plan', 'enforce_webinar_plan_limit',
    'enforce_registration_cap', 'set_question_answered', 'remove_room_attendee', 'is_anonymous_caller',
    'is_anonymous_user', 'get_join_preview', 'claim_registration', 'slugify', 'next_webinar_slug',
    'webinars_slug_guard', 'get_public_webinar_by_slug', 'list_my_registrations', 'room_member_role',
    'room_participant_json', 'get_room_access', 'set_room_panelist', 'request_to_speak',
    'drop_participant_on_revoke', 'set_practice_mode', 'clear_practice_on_status')
order by 1, 2;

-- 5. Data baseline (counts only, no personal data). KEEP THIS OUTPUT YOURSELF; don't send it (subscriptions = number of
--    paying customers). Re-run it after any future change to prove nothing was lost. --------------------------------
select 'webinars' as table_name, count(*) as rows from public.webinars
union all select 'registrations', count(*) from public.registrations
union all select 'recordings', count(*) from public.recordings
union all select 'subscriptions', count(*) from public.subscriptions
union all select 'webinar_usage', count(*) from public.webinar_usage
union all select 'room_messages', count(*) from public.room_messages
union all select 'room_questions', count(*) from public.room_questions
union all select 'room_polls', count(*) from public.room_polls;
-- Optional tables: NULL means the table doesn't exist.
select t as table_name,
       case when to_regclass('public.' || t) is null then null
            else (xpath('/table/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', t), true, false, '')))[1]::text::bigint
       end as rows
from unnest(array['email_log', 'room_participants']) as t;

-- 6. Webinars that would get slugs if event_slugs were applied (counts and the longest title length only). --------
select count(*) as webinars, max(char_length(title)) as longest_title,
       count(*) filter (where title !~ '[A-Za-z0-9]') as titles_without_letters_or_digits
from public.webinars;

-- 7. Platform settings that migrations rely on. ----------------------------------------------------------------
select extname, extversion from pg_extension where extname in ('pg_cron', 'pg_net', 'pgcrypto', 'citext') order by 1;

rollback;
