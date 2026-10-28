-- Panelists, request to speak, and practice mode.
--
-- Roles in the room:
--   host       the webinar owner: full control
--   panelist   an approved registrant the host brought on stage: mic + camera,
--              no admin controls
--   attendee   everyone else: view only, engagement only (chat, Q&A, polls,
--              reactions, raise hand, request to speak)
--
-- webinar_role() stays the access check (host / attendee / null) used by the
-- channel policies. room_member_role() refines 'attendee' into 'panelist' from
-- room_participants. Media permission is decided on the server: the
-- rtc-token route only issues publisher credentials to the host and to
-- panelists (get_room_access), and every client renders only the host uids
-- plus the rtc uids of current panelists.
--
-- Practice mode lets the host and panelists go on air together before the
-- webinar is live. Attendees stay in the waiting room and get no video
-- credentials until the host presses Go live.

-- ---------------------------------------------------------------------------
-- Participants
-- ---------------------------------------------------------------------------

create table public.room_participants (
  webinar_id         uuid not null references public.webinars (id) on delete cascade,
  user_id            uuid not null references auth.users (id) on delete cascade,
  role               text not null default 'attendee' check (role in ('attendee', 'panelist')),
  -- Fixed Agora uid while on stage; the token binds it, attendees render it.
  rtc_uid            integer check (rtc_uid between 100 and 199),
  speak_requested_at timestamptz,
  updated_at         timestamptz not null default now(),
  primary key (webinar_id, user_id),
  unique (webinar_id, rtc_uid),
  check ((role = 'panelist') = (rtc_uid is not null))
);

-- No client policies: all access goes through the functions below.
alter table public.room_participants enable row level security;

-- Panelists and messages/questions they write carry their own role.
alter table public.room_messages drop constraint room_messages_author_role_check;
alter table public.room_messages
  add constraint room_messages_author_role_check check (author_role in ('host', 'panelist', 'attendee'));
alter table public.room_questions drop constraint room_questions_author_role_check;
alter table public.room_questions
  add constraint room_questions_author_role_check check (author_role in ('host', 'panelist', 'attendee'));

alter table public.webinars add column practice_started_at timestamptz;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- 'host', 'panelist' or 'attendee' for the caller; null without access.
create function public.room_member_role(p_webinar_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when v.role = 'attendee' then coalesce((
      select p.role from public.room_participants p
      where p.webinar_id = p_webinar_id and p.user_id = auth.uid()
    ), 'attendee')
    else v.role
  end
  from (select public.webinar_role(p_webinar_id) as role) v;
$$;

create function public.room_participant_json(p public.room_participants)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'userId', p.user_id,
    'name', public.room_display_name(p.user_id),
    'role', p.role,
    'rtcUid', p.rtc_uid,
    'speakRequestedAt', p.speak_requested_at
  );
$$;

create or replace function public.room_settings_json(w public.webinars)
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
    'slowModeSeconds', w.slow_mode_seconds,
    'recording', w.is_recording,
    'spotlightQuestionId', w.spotlight_question_id,
    'practice', w.practice_started_at is not null
  );
$$;

-- What the rtc-token route needs to decide media permission.
-- { role, rtcUid, status, practice } or null without access.
create function public.get_room_access(p_webinar_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when v.role is not null then jsonb_build_object(
    'role', v.role,
    'rtcUid', (
      select p.rtc_uid from public.room_participants p
      where p.webinar_id = w.id and p.user_id = auth.uid() and p.role = 'panelist'
    ),
    'status', w.status,
    'practice', w.practice_started_at is not null
  ) end
  from public.webinars w
  cross join lateral (select public.room_member_role(w.id) as role) v
  where w.id = p_webinar_id;
$$;

-- ---------------------------------------------------------------------------
-- Snapshot: adds participants (panelists and open requests to speak)
-- ---------------------------------------------------------------------------

create or replace function public.get_room_snapshot(p_webinar_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_role    text := public.room_member_role(p_webinar_id);
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
    ), '[]'::jsonb),
    'participants', coalesce((
      select jsonb_agg(public.room_participant_json(p) order by p.rtc_uid nulls last, p.speak_requested_at)
      from public.room_participants p
      where p.webinar_id = p_webinar_id and (p.role = 'panelist' or p.speak_requested_at is not null)
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Chat and Q&A: panelists write as 'panelist' and, like the host, aren't
-- held back by the attendee chat switch or slow mode.
-- ---------------------------------------------------------------------------

create or replace function public.send_room_message(p_webinar_id uuid, p_text text, p_client_message_id text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_role    text := public.room_member_role(p_webinar_id);
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

  if not v_webinar.chat_enabled and v_role = 'attendee' then
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

  if v_role = 'attendee' and v_webinar.slow_mode_seconds > 0 then
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

create or replace function public.ask_question(p_webinar_id uuid, p_text text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_role text := public.room_member_role(p_webinar_id);
  v_id   uuid;
begin
  if v_role is null then
    perform public.room_fail('forbidden', 'You don''t have access to this webinar.');
  end if;
  if v_role = 'attendee' and not (select w.qna_enabled from public.webinars w where w.id = p_webinar_id) then
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

-- ---------------------------------------------------------------------------
-- Promote / demote, request to speak
-- ---------------------------------------------------------------------------

-- Host only. Promoting gives the person the lowest free stage uid (100–105);
-- demoting takes it away. Either way an open request to speak is cleared,
-- so "decline" is a demote of someone who isn't on stage.
create function public.set_room_panelist(p_webinar_id uuid, p_user_id uuid, p_panelist boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.room_participants%rowtype;
  v_uid integer;
begin
  if public.webinar_role(p_webinar_id) is distinct from 'host' then
    perform public.room_fail('forbidden', 'Only the host can change who is on stage.');
  end if;
  if p_user_id is null or p_user_id = auth.uid() then
    perform public.room_fail('invalid_payload', 'Choose an attendee.');
  end if;

  -- Serializes stage-slot allocation for this webinar.
  perform 1 from public.webinars w where w.id = p_webinar_id for update;

  if p_panelist then
    if not exists (
      select 1 from public.registrations r
      where r.webinar_id = p_webinar_id and r.user_id = p_user_id and r.status = 'approved'
    ) then
      perform public.room_fail('not_found', 'That person isn''t registered for this webinar.');
    end if;

    select * into v_row from public.room_participants p
    where p.webinar_id = p_webinar_id and p.user_id = p_user_id;
    if found and v_row.role = 'panelist' then
      return public.room_participant_json(v_row);
    end if;

    select min(s) into v_uid
    from generate_series(100, 105) s
    where not exists (
      select 1 from public.room_participants p where p.webinar_id = p_webinar_id and p.rtc_uid = s
    );
    if v_uid is null then
      perform public.room_fail('limit_reached', 'The stage is full (6 panelists). Move someone back to attendees first.');
    end if;

    insert into public.room_participants (webinar_id, user_id, role, rtc_uid, speak_requested_at, updated_at)
    values (p_webinar_id, p_user_id, 'panelist', v_uid, null, now())
    on conflict (webinar_id, user_id) do update
      set role = 'panelist', rtc_uid = excluded.rtc_uid, speak_requested_at = null, updated_at = now()
    returning * into v_row;
  else
    insert into public.room_participants (webinar_id, user_id, role, rtc_uid, speak_requested_at, updated_at)
    values (p_webinar_id, p_user_id, 'attendee', null, null, now())
    on conflict (webinar_id, user_id) do update
      set role = 'attendee', rtc_uid = null, speak_requested_at = null, updated_at = now()
    returning * into v_row;
  end if;

  perform public.room_broadcast(p_webinar_id, 'participant:updated', public.room_participant_json(v_row));
  return public.room_participant_json(v_row);
end;
$$;

-- Attendees ask to be brought on stage (or withdraw). Persisted, so the host
-- still sees it after either side reconnects.
create function public.request_to_speak(p_webinar_id uuid, p_requested boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_role text := public.room_member_role(p_webinar_id);
  v_row  public.room_participants%rowtype;
begin
  if v_role is null then
    perform public.room_fail('forbidden', 'You don''t have access to this webinar.');
  end if;
  if v_role <> 'attendee' then
    perform public.room_fail('invalid_payload', 'You''re already on stage.');
  end if;

  select * into v_row from public.room_participants p
  where p.webinar_id = p_webinar_id and p.user_id = v_uid;
  if found and (v_row.speak_requested_at is not null) = p_requested then
    return public.room_participant_json(v_row);
  end if;
  if found and v_row.updated_at > now() - interval '3 seconds' then
    perform public.room_fail('rate_limited', 'Slow down.');
  end if;

  insert into public.room_participants (webinar_id, user_id, role, speak_requested_at, updated_at)
  values (p_webinar_id, v_uid, 'attendee', case when p_requested then now() end, now())
  on conflict (webinar_id, user_id) do update
    set speak_requested_at = case when p_requested then now() end, updated_at = now()
  returning * into v_row;

  perform public.room_broadcast(p_webinar_id, 'participant:updated', public.room_participant_json(v_row));
  return public.room_participant_json(v_row);
end;
$$;

-- A revoked or removed registrant loses the stage (and their uid) with it.
create function public.drop_participant_on_revoke()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'approved' and new.status <> 'approved' then
    delete from public.room_participants p
    where p.webinar_id = new.webinar_id and p.user_id = new.user_id;
  end if;
  return null;
end;
$$;

create trigger registrations_drop_participant
  after update of status on public.registrations
  for each row execute function public.drop_participant_on_revoke();

-- ---------------------------------------------------------------------------
-- Practice mode
-- ---------------------------------------------------------------------------

create function public.set_practice_mode(p_webinar_id uuid, p_on boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_webinar public.webinars%rowtype;
begin
  if public.webinar_role(p_webinar_id) is distinct from 'host' then
    perform public.room_fail('forbidden', 'Only the host can start a practice session.');
  end if;

  update public.webinars w
    set practice_started_at = case when p_on then coalesce(w.practice_started_at, now()) end
    where w.id = p_webinar_id and (not p_on or w.status in ('draft', 'scheduled'))
    returning * into v_webinar;
  if not found then
    perform public.room_fail('invalid_status', 'Practice is only available before the webinar goes live.');
  end if;

  perform public.room_broadcast(p_webinar_id, 'webinar_settings:settings_updated', public.room_settings_json(v_webinar));
  return public.room_settings_json(v_webinar);
end;
$$;

-- Going live (or ending/cancelling) always ends practice.
create function public.clear_practice_on_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status not in ('draft', 'scheduled') then
    new.practice_started_at := null;
  end if;
  return new;
end;
$$;

create trigger webinars_clear_practice
  before update of status on public.webinars
  for each row execute function public.clear_practice_on_status();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function
  public.room_member_role(uuid),
  public.room_participant_json(public.room_participants),
  public.get_room_access(uuid),
  public.set_room_panelist(uuid, uuid, boolean),
  public.request_to_speak(uuid, boolean),
  public.drop_participant_on_revoke(),
  public.set_practice_mode(uuid, boolean),
  public.clear_practice_on_status()
from public, anon, authenticated;

grant execute on function
  public.get_room_access(uuid),
  public.set_room_panelist(uuid, uuid, boolean),
  public.request_to_speak(uuid, boolean),
  public.set_practice_mode(uuid, boolean)
to authenticated;

-- create or replace keeps existing grants, but restate the client-facing ones.
grant execute on function public.get_room_snapshot(uuid) to authenticated;
grant execute on function public.send_room_message(uuid, text, text) to authenticated;
grant execute on function public.ask_question(uuid, text) to authenticated;
