-- T1 migration reconciliation: READ-ONLY report for the Supabase SQL Editor (works on a phone).
--
-- Paste this whole file into SQL Editor -> New query -> Run. It is ONE select statement: it reads the system
-- catalogs and the migration history table and writes nothing. The result is a single cell named "report".
-- Copy that cell (or screenshot it) and send it back.
--
-- It returns NO secrets and NO personal data: no emails, names, titles, keys, connection strings, cron
-- commands, function bodies or migration SQL text. Only: migration version numbers and names, which expected
-- objects exist (yes/no), names of unexpected objects in the public schema, whether two optional tables exist,
-- the number of webinars and the longest title length (to size a future backfill), and installed extensions.
--
-- Source: supabase/checks/t1_readonly_report.sql (feature/deploy-grow-ui-integration). Docs:
-- docs/t1-migration-reconciliation.md.

with
-- Migration history (guarded: works whether or not the table and its name/statements columns exist).
hist_cols as (
  select count(*) filter (where column_name = 'name') as has_name,
         count(*) filter (where column_name = 'statements') as has_statements
  from information_schema.columns
  where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'
),
hist as (
  select (xpath('/row/version/text()', r))[1]::text as version,
         (xpath('/row/name/text()', r))[1]::text    as name,
         (xpath('/row/kind/text()', r))[1]::text    as kind
  from hist_cols,
       unnest(xpath('/table/row', query_to_xml(
         case
           when to_regclass('supabase_migrations.schema_migrations') is null
             then 'select null::text as version where false'
           when hist_cols.has_name = 1 and hist_cols.has_statements = 1
             then $q$select version, coalesce(name, '') as name,
                       case when statements[1] ilike '%public.slugify%' then 'event_slugs'
                            when statements[1] ilike '%public.room_participants%' then 'panelists_practice'
                            else 'other' end as kind
                     from supabase_migrations.schema_migrations$q$
           else $q$select version, '' as name, 'unknown' as kind from supabase_migrations.schema_migrations$q$
         end, true, false, ''))) as r
),
fn as (
  select p.proname, pg_get_functiondef(p.oid) as def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
),
col as (select table_name, column_name from information_schema.columns where table_schema = 'public'),
trg as (select t.tgname from pg_trigger t where not t.tgisinternal),
-- Expected objects per migration. Function checks use a body marker, so they show WHICH version is live.
checks(migration, object, present) as (
  values
  ('20261026000000_profiles', 'table profiles', to_regclass('public.profiles') is not null),
  ('20261026000000_profiles', 'trigger on_auth_user_created', exists (select 1 from trg where tgname = 'on_auth_user_created')),
  ('20261026010000_webinars', 'table webinars', to_regclass('public.webinars') is not null),
  ('20261026010000_webinars', 'table registrations', to_regclass('public.registrations') is not null),
  ('20261026010000_webinars', 'type webinar_status', to_regtype('public.webinar_status') is not null),
  ('20261026010000_webinars', 'trigger webinars_guard_status', exists (select 1 from trg where tgname = 'webinars_guard_status')),
  ('20261026020000_fields_lifecycle_recordings', 'table recordings', to_regclass('public.recordings') is not null),
  ('20261026020000_fields_lifecycle_recordings', 'column webinars.custom_fields', exists (select 1 from col where table_name = 'webinars' and column_name = 'custom_fields')),
  ('20261026020000_fields_lifecycle_recordings', 'column registrations.answers', exists (select 1 from col where table_name = 'registrations' and column_name = 'answers')),
  ('20261026030000_realtime_room', 'table room_messages', to_regclass('public.room_messages') is not null),
  ('20261026030000_realtime_room', 'table room_polls', to_regclass('public.room_polls') is not null),
  ('20261026030000_realtime_room', 'function webinar_role', exists (select 1 from fn where proname = 'webinar_role')),
  ('20261026030000_realtime_room', 'policy realtime.messages receive', exists (select 1 from pg_policies where schemaname = 'realtime' and tablename = 'messages' and policyname = 'room: members can receive')),
  ('20261026030000_realtime_room', 'column webinars.slow_mode_seconds', exists (select 1 from col where table_name = 'webinars' and column_name = 'slow_mode_seconds')),
  ('20261027000000_plans_billing', 'table subscriptions', to_regclass('public.subscriptions') is not null),
  ('20261027000000_plans_billing', 'table webinar_usage', to_regclass('public.webinar_usage') is not null),
  ('20261027000000_plans_billing', 'function user_plan', exists (select 1 from fn where proname = 'user_plan')),
  ('20261027000000_plans_billing', 'trigger webinars_enforce_plan_limit', exists (select 1 from trg where tgname = 'webinars_enforce_plan_limit')),
  ('20261027000000_plans_billing', 'trigger registrations_enforce_cap', exists (select 1 from trg where tgname = 'registrations_enforce_cap')),
  ('20261027000000_plans_billing', 'start_webinar has plan limit', exists (select 1 from fn where proname = 'start_webinar' and def like '%plan_webinar_limit%')),
  ('20261027000000_plans_billing', 'get_public_webinar has attendee limit', exists (select 1 from fn where proname = 'get_public_webinar' and def like '%webinar_attendee_limit%')),
  ('20261027000000_plans_billing', 'end_webinar clears recording', exists (select 1 from fn where proname = 'end_webinar' and def like '%is_recording%')),
  ('20261028000000_guest_join', 'column registrations.join_token', exists (select 1 from col where table_name = 'registrations' and column_name = 'join_token')),
  ('20261028000000_guest_join', 'function claim_registration', exists (select 1 from fn where proname = 'claim_registration')),
  ('20261028000000_guest_join', 'register_for_webinar guest-aware', exists (select 1 from fn where proname = 'register_for_webinar' and def like '%is_anonymous_caller%')),
  ('20261028000000_guest_join', 'policy guests can''t create', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'webinars' and policyname = 'webinars: guests can''t create')),
  ('20261029000000_email_notifications', 'type email_kind', to_regtype('public.email_kind') is not null),
  ('20261029000000_email_notifications', 'table email_log', to_regclass('public.email_log') is not null),
  ('20261030000000_event_slugs', 'column webinars.slug', exists (select 1 from col where table_name = 'webinars' and column_name = 'slug')),
  ('20261030000000_event_slugs', 'index webinars_slug_key', to_regclass('public.webinars_slug_key') is not null),
  ('20261030000000_event_slugs', 'trigger webinars_slug_guard', exists (select 1 from trg where tgname = 'webinars_slug_guard')),
  ('20261030000000_event_slugs', 'function get_public_webinar_by_slug', exists (select 1 from fn where proname = 'get_public_webinar_by_slug')),
  ('20261030000000_event_slugs', 'function list_my_registrations', exists (select 1 from fn where proname = 'list_my_registrations')),
  ('20261030000000_panelists_practice', 'table room_participants', to_regclass('public.room_participants') is not null),
  ('20261030000000_panelists_practice', 'column webinars.practice_started_at', exists (select 1 from col where table_name = 'webinars' and column_name = 'practice_started_at')),
  ('20261030000000_panelists_practice', 'function get_room_access', exists (select 1 from fn where proname = 'get_room_access')),
  ('20261030000000_panelists_practice', 'trigger webinars_clear_practice', exists (select 1 from trg where tgname = 'webinars_clear_practice')),
  ('20261030000000_panelists_practice', 'trigger registrations_drop_participant', exists (select 1 from trg where tgname = 'registrations_drop_participant')),
  ('20261030000000_panelists_practice', 'send_room_message panelist-aware', exists (select 1 from fn where proname = 'send_room_message' and def like '%room_member_role%')),
  ('20261030000000_panelists_practice', 'room_settings_json has practice', exists (select 1 from fn where proname = 'room_settings_json' and def like '%''practice''%')),
  ('20261030000000_panelists_practice', 'author_role allows panelist', exists (select 1 from pg_constraint where conname = 'room_messages_author_role_check' and pg_get_constraintdef(oid) like '%panelist%'))
),
per_migration as (
  select migration,
         case when bool_and(present) then 'ALL'
              when bool_or(present) then 'SOME (missing: ' || string_agg(object, ', ' order by object) filter (where not present) || ')'
              else 'NONE' end as status
  from checks group by migration
),
known_tables(name) as (values ('profiles'), ('webinars'), ('registrations'), ('recordings'), ('room_messages'),
  ('room_questions'), ('room_question_upvotes'), ('room_polls'), ('room_poll_votes'), ('subscriptions'),
  ('webinar_usage'), ('email_log'), ('room_participants')),
known_functions(name) as (values ('set_updated_at'), ('handle_new_user'), ('guard_webinar_status'),
  ('get_public_webinar'), ('register_for_webinar'), ('start_webinar'), ('end_webinar'), ('webinar_role'),
  ('room_topic_role'), ('room_fail'), ('room_display_name'), ('room_clean_text'), ('room_broadcast'),
  ('room_settings_json'), ('room_message_json'), ('room_question_json'), ('room_poll_json'), ('get_room_snapshot'),
  ('send_room_message'), ('ask_question'), ('toggle_question_upvote'), ('create_poll'), ('vote_poll'), ('close_poll'),
  ('update_room_settings'), ('lower_room_hand'), ('broadcast_webinar_status'), ('user_plan'), ('plan_attendee_cap'),
  ('webinar_attendee_limit'), ('get_my_plan'), ('enforce_webinar_plan_limit'), ('enforce_registration_cap'),
  ('set_question_answered'), ('remove_room_attendee'), ('is_anonymous_caller'), ('is_anonymous_user'),
  ('get_join_preview'), ('claim_registration'), ('slugify'), ('next_webinar_slug'), ('webinars_slug_guard'),
  ('get_public_webinar_by_slug'), ('list_my_registrations'), ('room_member_role'), ('room_participant_json'),
  ('get_room_access'), ('set_room_panelist'), ('request_to_speak'), ('drop_participant_on_revoke'),
  ('set_practice_mode'), ('clear_practice_on_status')),
unexpected as (
  select 'table ' || c.relname as item
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
    and c.relname not in (select name from known_tables)
  union
  select 'function ' || p.proname
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname not in (select name from known_functions)
),
webinar_size as (
  select (xpath('/table/row/n/text()', x))[1]::text as n, (xpath('/table/row/l/text()', x))[1]::text as l
  from (select query_to_xml(
          case when to_regclass('public.webinars') is not null
               then 'select count(*) as n, coalesce(max(char_length(title)), 0) as l from public.webinars'
               else 'select null::int as n, null::int as l' end, true, false, '') as x) s
),
lines(ord, line) as (
  select 0, 'T1 READ-ONLY REPORT v1'
  union all select 1, 'postgres: ' || current_setting('server_version')
  union all select 2, 'history table: ' || case when to_regclass('supabase_migrations.schema_migrations') is null then 'ABSENT' else 'present' end
          || ' (name column: ' || (select case when has_name = 1 then 'yes' else 'no' end from hist_cols)
          || ', statements column: ' || (select case when has_statements = 1 then 'yes' else 'no' end from hist_cols) || ')'
  union all select 3, 'history rows: ' || (select count(*) from hist)::text
  union all select 10 + row_number() over (order by version), '  history ' || version || ' ' || coalesce(nullif(name, ''), '(no name)') || ' [' || kind || ']' from hist
  union all select 500, 'objects:'
  union all select 500 + row_number() over (order by migration), '  ' || migration || ': ' || status from per_migration
  union all select 600, 'unexpected public objects: ' || coalesce((select string_agg(item, ', ' order by item) from unexpected), 'none')
  union all select 700, 'optional tables: email_log=' || case when to_regclass('public.email_log') is null then 'absent' else 'present' end
          || ', room_participants=' || case when to_regclass('public.room_participants') is null then 'absent' else 'present' end
  union all select 800, 'webinars: ' || coalesce((select n from webinar_size), 'n/a') || ' rows, longest title ' || coalesce((select l from webinar_size), 'n/a') || ' chars'
  union all select 900, 'extensions: ' || coalesce((select string_agg(extname || ' ' || extversion, ', ' order by extname) from pg_extension where extname in ('pg_cron', 'pg_net', 'pgcrypto', 'citext')), 'none of pg_cron/pg_net/pgcrypto/citext')
  union all select 999, 'END'
)
select string_agg(line, E'\n' order by ord) as report from lines;
