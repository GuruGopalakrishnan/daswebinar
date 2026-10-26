-- Live room on Supabase Realtime (replaces the Socket.IO server).
--
-- Channels (all private, authorized by RLS on realtime.messages):
--   room:<webinar id>            Broadcast from the database only, plus Presence.
--                                Members receive; clients may track presence
--                                but can't send broadcasts, so chat, Q&A, polls,
--                                settings and status events can't be forged.
--   room:<webinar id>:reactions  Client-to-client Broadcast for emoji reactions.
--
-- Chat, Q&A, polls and settings are written through the security definer
-- functions below. Each checks room access, settings and rate limits, stores
-- the row (so late joiners get history) and then broadcasts with
-- realtime.send(). Presence carries the live count, roster and hand raises.
--
-- Errors are raised as message = machine code, detail = user-facing text.

-- ---------------------------------------------------------------------------
-- Room settings (persisted per webinar; changed through update_room_settings)
-- ---------------------------------------------------------------------------

alter table public.webinars
  add column chat_enabled       boolean not null default true,
  add column qna_enabled        boolean not null default true,
  add column reactions_enabled  boolean not null default true,
  add column hand_raise_enabled boolean not null default true,
  add column slow_mode_seconds  integer not null default 0 check (slow_mode_seconds between 0 and 300);

-- ---------------------------------------------------------------------------
-- Tables (no client policies: all access goes through the functions below)
-- ---------------------------------------------------------------------------

create table public.room_messages (
  id                uuid primary key default gen_random_uuid(),
  webinar_id        uuid not null references public.webinars (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  author_name       text not null,
  author_role       text not null check (author_role in ('host', 'attendee')),
  client_message_id text not null check (char_length(client_message_id) between 1 and 64),
  text              text not null check (char_length(text) between 1 and 500),
  created_at        timestamptz not null default now(),
  unique (webinar_id, user_id, client_message_id)
);

create index room_messages_webinar_idx on public.room_messages (webinar_id, created_at desc);
create index room_messages_user_idx on public.room_messages (webinar_id, user_id, created_at desc);

create table public.room_questions (
  id          uuid primary key default gen_random_uuid(),
  webinar_id  uuid not null references public.webinars (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  author_name text not null,
  author_role text not null check (author_role in ('host', 'attendee')),
  text        text not null check (char_length(text) between 1 and 300),
  created_at  timestamptz not null default now()
);

create index room_questions_webinar_idx on public.room_questions (webinar_id, created_at);

create table public.room_question_upvotes (
  question_id uuid not null references public.room_questions (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  primary key (question_id, user_id)
);

create table public.room_polls (
  id         uuid primary key default gen_random_uuid(),
  webinar_id uuid not null references public.webinars (id) on delete cascade,
  question   text not null check (char_length(question) between 1 and 200),
  -- [{ id, text }]
  options    jsonb not null check (jsonb_typeof(options) = 'array'),
  closed     boolean not null default false,
  created_at timestamptz not null default now()
);

create index room_polls_webinar_idx on public.room_polls (webinar_id, created_at);

create table public.room_poll_votes (
  poll_id   uuid not null references public.room_polls (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  option_id text not null,
  primary key (poll_id, user_id)
);

alter table public.room_messages enable row level security;
alter table public.room_questions enable row level security;
alter table public.room_question_upvotes enable row level security;
alter table public.room_polls enable row level security;
alter table public.room_poll_votes enable row level security;

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

-- 'host' unless the webinar is cancelled; 'attendee' for an approved,
-- signed-in registrant while the webinar is scheduled or live; else null.
create function public.webinar_role(p_webinar_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when w.host_id = auth.uid() then
      case when w.status <> 'cancelled' then 'host' end
    when w.status in ('scheduled', 'live') and exists (
      select 1 from public.registrations r
      where r.webinar_id = w.id and r.user_id = auth.uid() and r.status = 'approved'
    ) then 'attendee'
  end
  from public.webinars w
  where w.id = p_webinar_id and auth.uid() is not null;
$$;

-- Role for a channel topic: room:<uuid> or room:<uuid>:reactions.
create function public.room_topic_role(p_topic text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.webinar_role(t.parts[1]::uuid)
  from regexp_match(
    p_topic,
    '^room:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(:reactions)?$'
  ) as t(parts);
$$;

create function public.room_fail(p_code text, p_message text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = p_code, detail = p_message;
end;
$$;

-- Same identity rule as the old socket server: full name, else email prefix.
create function public.room_display_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select left(coalesce(
    nullif(btrim(p.full_name), ''),
    nullif(split_part(u.email, '@', 1), ''),
    'Guest'
  ), 100)
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = p_user_id;
$$;

-- Strip control characters other than newline/tab, trim, enforce length.
create function public.room_clean_text(p_text text, p_max integer)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_text text := btrim(regexp_replace(coalesce(p_text, ''), '[\x01-\x08\x0B-\x1F\x7F]', '', 'g'));
begin
  if char_length(v_text) = 0 or char_length(v_text) > p_max then
    perform public.room_fail('invalid_payload', format('Must be between 1 and %s characters.', p_max));
  end if;
  return v_text;
end;
$$;

-- Wraps realtime.send so every room event goes to the same private topic.
create function public.room_broadcast(p_webinar_id uuid, p_event text, p_payload jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  select realtime.send(p_payload, p_event, 'room:' || p_webinar_id::text, true);
$$;

-- ---------------------------------------------------------------------------
-- JSON views (shapes match src/lib/realtime/protocol.ts)
-- ---------------------------------------------------------------------------

create function public.room_settings_json(w public.webinars)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'chatEnabled', w.chat_enabled,
    'qnaEnabled', w.qna_enabled,
    'reactionsEnabled', w.reactions_enabled,
    'handRaiseEnabled', w.hand_raise_enabled,
    'slowModeSeconds', w.slow_mode_seconds
  );
$$;

create function public.room_message_json(m public.room_messages)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', m.id,
    'clientMessageId', m.client_message_id,
    'author', jsonb_build_object('userId', m.user_id, 'name', m.author_name, 'role', m.author_role),
    'text', m.text,
    'sentAt', m.created_at
  );
$$;

-- p_viewer null = broadcast view (upvotedByMe false).
create function public.room_question_json(p_question_id uuid, p_viewer uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', q.id,
    'author', jsonb_build_object('userId', q.user_id, 'name', q.author_name, 'role', q.author_role),
    'text', q.text,
    'askedAt', q.created_at,
    'upvotes', (select count(*) from public.room_question_upvotes u where u.question_id = q.id),
    'upvotedByMe', p_viewer is not null and exists (
      select 1 from public.room_question_upvotes u where u.question_id = q.id and u.user_id = p_viewer
    )
  )
  from public.room_questions q
  where q.id = p_question_id;
$$;

-- p_viewer null = broadcast view (myVote null).
create function public.room_poll_json(p_poll_id uuid, p_viewer uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'question', p.question,
    'options', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', o.value ->> 'id',
          'text', o.value ->> 'text',
          'votes', (select count(*) from public.room_poll_votes v where v.poll_id = p.id and v.option_id = o.value ->> 'id')
        ) order by o.ord
      ), '[]'::jsonb)
      from jsonb_array_elements(p.options) with ordinality as o(value, ord)
    ),
    'createdAt', p.created_at,
    'closed', p.closed,
    'myVote', (select v.option_id from public.room_poll_votes v where v.poll_id = p.id and v.user_id = p_viewer)
  )
  from public.room_polls p
  where p.id = p_poll_id;
$$;

-- ---------------------------------------------------------------------------
-- Snapshot (called after subscribing, and again after every reconnect)
-- ---------------------------------------------------------------------------

create function public.get_room_snapshot(p_webinar_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_role    text := public.webinar_role(p_webinar_id);
  v_webinar public.webinars%rowtype;
begin
  if v_role is null then
    perform public.room_fail('forbidden', 'You don''t have access to this webinar.');
  end if;
  select * into v_webinar from public.webinars w where w.id = p_webinar_id;

  return jsonb_build_object(
    'webinarId', p_webinar_id,
    'role', v_role,
    'hostId', v_webinar.host_id,
    'me', jsonb_build_object('userId', v_uid, 'name', public.room_display_name(v_uid), 'role', v_role),
    'settings', public.room_settings_json(v_webinar),
    'messages', coalesce((
      select jsonb_agg(public.room_message_json(recent.m) order by (recent.m).created_at)
      from (
        select m from public.room_messages m
        where m.webinar_id = p_webinar_id
        order by m.created_at desc
        limit 200
      ) recent
    ), '[]'::jsonb),
    'questions', coalesce((
      select jsonb_agg(public.room_question_json(q.id, v_uid) order by q.created_at)
      from public.room_questions q
      where q.webinar_id = p_webinar_id
    ), '[]'::jsonb),
    'polls', coalesce((
      select jsonb_agg(public.room_poll_json(p.id, v_uid) order by p.created_at)
      from public.room_polls p
      where p.webinar_id = p_webinar_id
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------

create function public.send_room_message(p_webinar_id uuid, p_text text, p_client_message_id text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_role    text := public.webinar_role(p_webinar_id);
  v_webinar public.webinars%rowtype;
  v_message public.room_messages%rowtype;
  v_last    timestamptz;
  v_wait    integer;
begin
  if v_role is null then
    perform public.room_fail('forbidden', 'You don''t have access to this webinar.');
  end if;
  if char_length(coalesce(p_client_message_id, '')) not between 1 and 64 then
    perform public.room_fail('invalid_payload', 'Invalid message id.');
  end if;
  select * into v_webinar from public.webinars w where w.id = p_webinar_id;

  if not v_webinar.chat_enabled and v_role <> 'host' then
    perform public.room_fail('chat_disabled', 'Chat is turned off.');
  end if;

  -- Idempotent retries: the same clientMessageId returns the original.
  select * into v_message from public.room_messages m
  where m.webinar_id = p_webinar_id and m.user_id = v_uid and m.client_message_id = p_client_message_id;
  if found then
    return public.room_message_json(v_message);
  end if;

  if (
    select count(*) from public.room_messages m
    where m.webinar_id = p_webinar_id and m.user_id = v_uid and m.created_at > now() - interval '10 seconds'
  ) >= 5 then
    perform public.room_fail('rate_limited', 'Slow down.');
  end if;

  if v_role <> 'host' and v_webinar.slow_mode_seconds > 0 then
    select max(m.created_at) into v_last from public.room_messages m
    where m.webinar_id = p_webinar_id and m.user_id = v_uid;
    v_wait := ceil(extract(epoch from (v_last + make_interval(secs => v_webinar.slow_mode_seconds) - now())));
    if v_wait > 0 then
      perform public.room_fail('slow_mode', format('Slow mode: wait %ss.', v_wait));
    end if;
  end if;

  insert into public.room_messages (webinar_id, user_id, author_name, author_role, client_message_id, text)
  values (
    p_webinar_id, v_uid, public.room_display_name(v_uid), v_role, p_client_message_id,
    public.room_clean_text(p_text, 500)
  )
  on conflict (webinar_id, user_id, client_message_id) do nothing
  returning * into v_message;

  -- Lost a race with a concurrent retry of the same message.
  if not found then
    select * into v_message from public.room_messages m
    where m.webinar_id = p_webinar_id and m.user_id = v_uid and m.client_message_id = p_client_message_id;
    return public.room_message_json(v_message);
  end if;

  perform public.room_broadcast(p_webinar_id, 'public_chat:new_message', public.room_message_json(v_message));
  return public.room_message_json(v_message);
end;
$$;

-- ---------------------------------------------------------------------------
-- Q&A
-- ---------------------------------------------------------------------------

create function public.ask_question(p_webinar_id uuid, p_text text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_role text := public.webinar_role(p_webinar_id);
  v_id   uuid;
begin
  if v_role is null then
    perform public.room_fail('forbidden', 'You don''t have access to this webinar.');
  end if;
  if v_role <> 'host' and not (select w.qna_enabled from public.webinars w where w.id = p_webinar_id) then
    perform public.room_fail('qna_disabled', 'Q&A is turned off.');
  end if;
  if (select count(*) from public.room_questions q where q.webinar_id = p_webinar_id) >= 500 then
    perform public.room_fail('limit_reached', 'This session has reached its question limit.');
  end if;
  if (
    select count(*) from public.room_questions q
    where q.webinar_id = p_webinar_id and q.user_id = v_uid and q.created_at > now() - interval '30 seconds'
  ) >= 3 then
    perform public.room_fail('rate_limited', 'Slow down.');
  end if;

  insert into public.room_questions (webinar_id, user_id, author_name, author_role, text)
  values (p_webinar_id, v_uid, public.room_display_name(v_uid), v_role, public.room_clean_text(p_text, 300))
  returning id into v_id;

  perform public.room_broadcast(p_webinar_id, 'qna:new_question', public.room_question_json(v_id, null));
  return public.room_question_json(v_id, v_uid);
end;
$$;

-- Toggles the caller's upvote. Authors can't upvote their own question.
create function public.toggle_question_upvote(p_question_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_question public.room_questions%rowtype;
begin
  select * into v_question from public.room_questions q where q.id = p_question_id;
  if not found or public.webinar_role(v_question.webinar_id) is null then
    perform public.room_fail('not_found', 'Question not found.');
  end if;
  if v_question.user_id = v_uid then
    perform public.room_fail('own_question', 'You can''t upvote your own question.');
  end if;

  delete from public.room_question_upvotes u where u.question_id = p_question_id and u.user_id = v_uid;
  if not found then
    insert into public.room_question_upvotes (question_id, user_id) values (p_question_id, v_uid)
    on conflict do nothing;
  end if;

  perform public.room_broadcast(v_question.webinar_id, 'qna:question_updated', public.room_question_json(p_question_id, null));
  return public.room_question_json(p_question_id, v_uid);
end;
$$;

-- ---------------------------------------------------------------------------
-- Polls
-- ---------------------------------------------------------------------------

create function public.create_poll(p_webinar_id uuid, p_question text, p_options text[])
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_options jsonb := '[]'::jsonb;
  v_option  text;
  v_seen    text[] := '{}';
  v_id      uuid;
begin
  if public.webinar_role(p_webinar_id) is distinct from 'host' then
    perform public.room_fail('forbidden', 'Only the host can create polls.');
  end if;
  if (select count(*) from public.room_polls p where p.webinar_id = p_webinar_id) >= 20 then
    perform public.room_fail('limit_reached', 'Poll limit reached.');
  end if;
  if coalesce(cardinality(p_options), 0) not between 2 and 6 then
    perform public.room_fail('invalid_payload', 'A poll needs 2 to 6 options.');
  end if;

  foreach v_option in array p_options loop
    v_option := public.room_clean_text(v_option, 100);
    if lower(v_option) = any (v_seen) then
      perform public.room_fail('invalid_payload', 'Poll options must be unique.');
    end if;
    v_seen := v_seen || lower(v_option);
    v_options := v_options || jsonb_build_object('id', gen_random_uuid()::text, 'text', v_option);
  end loop;

  insert into public.room_polls (webinar_id, question, options)
  values (p_webinar_id, public.room_clean_text(p_question, 200), v_options)
  returning id into v_id;

  perform public.room_broadcast(p_webinar_id, 'poll:poll_created', public.room_poll_json(v_id, null));
  return public.room_poll_json(v_id, auth.uid());
end;
$$;

-- One vote per user; voting again changes the vote.
create function public.vote_poll(p_poll_id uuid, p_option_id text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_poll public.room_polls%rowtype;
begin
  select * into v_poll from public.room_polls p where p.id = p_poll_id;
  if not found or public.webinar_role(v_poll.webinar_id) is null then
    perform public.room_fail('not_found', 'Poll not found.');
  end if;
  if v_poll.closed then
    perform public.room_fail('poll_closed', 'This poll is closed.');
  end if;
  if not exists (select 1 from jsonb_array_elements(v_poll.options) o where o.value ->> 'id' = p_option_id) then
    perform public.room_fail('invalid_option', 'Unknown option.');
  end if;

  insert into public.room_poll_votes (poll_id, user_id, option_id)
  values (p_poll_id, auth.uid(), p_option_id)
  on conflict (poll_id, user_id) do update set option_id = excluded.option_id;

  perform public.room_broadcast(v_poll.webinar_id, 'poll:results', public.room_poll_json(p_poll_id, null));
  return public.room_poll_json(p_poll_id, auth.uid());
end;
$$;

create function public.close_poll(p_poll_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_webinar_id uuid;
begin
  select p.webinar_id into v_webinar_id from public.room_polls p where p.id = p_poll_id;
  if not found or public.webinar_role(v_webinar_id) is distinct from 'host' then
    perform public.room_fail('forbidden', 'Only the host can close polls.');
  end if;

  update public.room_polls set closed = true where id = p_poll_id;

  perform public.room_broadcast(v_webinar_id, 'poll:closed', public.room_poll_json(p_poll_id, null));
  return public.room_poll_json(p_poll_id, auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- Settings, hand raise, status
-- ---------------------------------------------------------------------------

-- Partial update: { chatEnabled?, qnaEnabled?, reactionsEnabled?, handRaiseEnabled?, slowModeSeconds? }
create function public.update_room_settings(p_webinar_id uuid, p_settings jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key     text;
  v_webinar public.webinars%rowtype;
begin
  if public.webinar_role(p_webinar_id) is distinct from 'host' then
    perform public.room_fail('forbidden', 'Only the host can change settings.');
  end if;
  if jsonb_typeof(p_settings) is distinct from 'object' or p_settings = '{}'::jsonb then
    perform public.room_fail('invalid_payload', 'Provide at least one setting.');
  end if;
  for v_key in select jsonb_object_keys(p_settings) loop
    if v_key in ('chatEnabled', 'qnaEnabled', 'reactionsEnabled', 'handRaiseEnabled') then
      if jsonb_typeof(p_settings -> v_key) <> 'boolean' then
        perform public.room_fail('invalid_payload', format('%s must be true or false.', v_key));
      end if;
    elsif v_key = 'slowModeSeconds' then
      if jsonb_typeof(p_settings -> v_key) <> 'number'
         or (p_settings ->> v_key)::numeric not between 0 and 300
         or (p_settings ->> v_key)::numeric <> trunc((p_settings ->> v_key)::numeric) then
        perform public.room_fail('invalid_payload', 'Slow mode must be 0 to 300 seconds.');
      end if;
    else
      perform public.room_fail('invalid_payload', format('Unknown setting %s.', v_key));
    end if;
  end loop;

  update public.webinars w set
    chat_enabled       = coalesce((p_settings ->> 'chatEnabled')::boolean, w.chat_enabled),
    qna_enabled        = coalesce((p_settings ->> 'qnaEnabled')::boolean, w.qna_enabled),
    reactions_enabled  = coalesce((p_settings ->> 'reactionsEnabled')::boolean, w.reactions_enabled),
    hand_raise_enabled = coalesce((p_settings ->> 'handRaiseEnabled')::boolean, w.hand_raise_enabled),
    slow_mode_seconds  = coalesce((p_settings ->> 'slowModeSeconds')::integer, w.slow_mode_seconds)
  where w.id = p_webinar_id
  returning * into v_webinar;

  perform public.room_broadcast(p_webinar_id, 'webinar_settings:settings_updated', public.room_settings_json(v_webinar));
  return public.room_settings_json(v_webinar);
end;
$$;

-- Hand raises live in Presence (each attendee tracks their own). The host
-- lowers someone else's hand by asking that client, via a database broadcast
-- that attendees can't forge.
create function public.lower_room_hand(p_webinar_id uuid, p_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if public.webinar_role(p_webinar_id) is distinct from 'host' then
    perform public.room_fail('forbidden', 'Only the host can lower someone else''s hand.');
  end if;
  perform public.room_broadcast(p_webinar_id, 'handraise:lower_hand', jsonb_build_object('userId', p_user_id));
end;
$$;

-- Lifecycle changes (start_webinar / end_webinar) reach everyone in the room.
create function public.broadcast_webinar_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('live', 'ended') and new.status is distinct from old.status then
    perform public.room_broadcast(new.id, 'webinar:status_changed', jsonb_build_object('status', new.status));
  end if;
  return null;
end;
$$;

create trigger webinars_broadcast_status
  after update of status on public.webinars
  for each row execute function public.broadcast_webinar_status();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- Supabase's default privileges grant every new function to anon and
-- authenticated. Revoke all of them (room_broadcast in particular would let
-- anyone forge room events), then grant back only the client-facing ones.
revoke execute on function
  public.webinar_role(uuid),
  public.room_topic_role(text),
  public.room_fail(text, text),
  public.room_display_name(uuid),
  public.room_clean_text(text, integer),
  public.room_broadcast(uuid, text, jsonb),
  public.room_settings_json(public.webinars),
  public.room_message_json(public.room_messages),
  public.room_question_json(uuid, uuid),
  public.room_poll_json(uuid, uuid),
  public.get_room_snapshot(uuid),
  public.send_room_message(uuid, text, text),
  public.ask_question(uuid, text),
  public.toggle_question_upvote(uuid),
  public.create_poll(uuid, text, text[]),
  public.vote_poll(uuid, text),
  public.close_poll(uuid),
  public.update_room_settings(uuid, jsonb),
  public.lower_room_hand(uuid, uuid),
  public.broadcast_webinar_status()
from public, anon, authenticated;

grant execute on function
  -- Used by the realtime.messages policies, which run as the caller.
  public.room_topic_role(text),
  public.get_room_snapshot(uuid),
  public.send_room_message(uuid, text, text),
  public.ask_question(uuid, text),
  public.toggle_question_upvote(uuid),
  public.create_poll(uuid, text, text[]),
  public.vote_poll(uuid, text),
  public.close_poll(uuid),
  public.update_room_settings(uuid, jsonb),
  public.lower_room_hand(uuid, uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime authorization (private channels)
-- ---------------------------------------------------------------------------

create policy "room: members can receive"
  on realtime.messages for select
  to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.room_topic_role((select realtime.topic())) is not null
  );

create policy "room: members can track presence and send reactions"
  on realtime.messages for insert
  to authenticated
  with check (
    public.room_topic_role((select realtime.topic())) is not null
    and case
      when (select realtime.topic()) like '%:reactions' then realtime.messages.extension = 'broadcast'
      else realtime.messages.extension = 'presence'
    end
  );
