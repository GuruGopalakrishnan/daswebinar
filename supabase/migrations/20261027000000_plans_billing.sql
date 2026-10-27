-- Plans, Razorpay subscriptions, plan limits, and room additions
-- (recording indicator, question spotlight/answered, removing attendees).
--
-- Plans:
--   free  one webinar per account, at most 100 registrants (pending + approved)
--   pro   unlimited webinars and attendees, while a Razorpay subscription is paid up
--
-- Limits are enforced here, not in the API, so every write path is covered:
--   * webinars insert trigger       free hosts can have one webinar
--   * start_webinar()               free hosts can run one webinar, ever
--   * register_for_webinar()        attendee cap
--   * registrations update trigger  approving a rejected registrant respects the cap
--
-- Subscriptions are written only with the service role (Razorpay webhook and the
-- payment verification route). Clients can read their own row.

-- ---------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  user_id                  uuid primary key references auth.users (id) on delete cascade,
  plan                     text not null default 'pro' check (plan in ('pro')),
  -- Razorpay subscription states.
  status                   text not null check (status in (
                             'created', 'authenticated', 'active', 'pending',
                             'halted', 'cancelled', 'completed', 'expired', 'paused')),
  razorpay_subscription_id text unique,
  razorpay_customer_id     text,
  current_period_end       timestamptz,
  cancel_at_period_end     boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

create policy "subscriptions: owner can read"
  on public.subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.subscriptions from anon, authenticated;

-- Webinars that have gone live, kept after the webinar is deleted so deleting a
-- finished webinar doesn't give a free host another one.
create table public.webinar_usage (
  webinar_id uuid primary key,
  host_id    uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now()
);

create index webinar_usage_host_idx on public.webinar_usage (host_id);
alter table public.webinar_usage enable row level security;

insert into public.webinar_usage (webinar_id, host_id, started_at)
select w.id, w.host_id, w.started_at from public.webinars w where w.started_at is not null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Plan helpers
-- ---------------------------------------------------------------------------

-- 'pro' while a subscription is paid up. One day of grace covers webhook
-- latency at renewal; 'pending' (Razorpay is retrying a failed charge) keeps
-- access until the period runs out.
create function public.user_plan(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when exists (
    select 1 from public.subscriptions s
    where s.user_id = p_user_id
      and s.status in ('authenticated', 'active', 'pending', 'cancelled')
      and s.current_period_end is not null
      and s.current_period_end + interval '1 day' > now()
  ) then 'pro' else 'free' end;
$$;

create function public.plan_attendee_cap(p_plan text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when p_plan = 'free' then 100 end;
$$;

-- Effective registrant limit: the host's own capacity, capped by their plan.
create function public.webinar_attendee_limit(w public.webinars)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.user_plan(w.host_id) = 'free' then least(coalesce(w.capacity, 100), 100)
    else w.capacity
  end;
$$;

-- Everything the dashboard needs to show the plan and its limits.
create function public.get_my_plan()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'plan', public.user_plan(auth.uid()),
    'status', s.status,
    'currentPeriodEnd', s.current_period_end,
    'cancelAtPeriodEnd', coalesce(s.cancel_at_period_end, false),
    'webinarCount', (select count(*) from public.webinars w where w.host_id = auth.uid()),
    'webinarsRun', (select count(*) from public.webinar_usage u where u.host_id = auth.uid()),
    'attendeeCap', public.plan_attendee_cap(public.user_plan(auth.uid()))
  )
  from (select 1) one
  left join public.subscriptions s on s.user_id = auth.uid()
  where auth.uid() is not null;
$$;

-- ---------------------------------------------------------------------------
-- Webinar limit
-- ---------------------------------------------------------------------------

create function public.enforce_webinar_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serialize creates per host so two parallel requests can't both pass.
  perform pg_advisory_xact_lock(hashtextextended('webinar_limit:' || new.host_id::text, 0));
  if public.user_plan(new.host_id) = 'free' and (
       exists (select 1 from public.webinars w where w.host_id = new.host_id)
       or exists (select 1 from public.webinar_usage u where u.host_id = new.host_id)
     ) then
    raise exception 'plan_webinar_limit'
      using errcode = 'P0001', hint = 'The free plan includes one webinar.';
  end if;
  return new;
end;
$$;

create trigger webinars_enforce_plan_limit
  before insert on public.webinars
  for each row execute function public.enforce_webinar_plan_limit();

-- A free host (including a Pro host whose subscription lapsed) can run only
-- the one webinar they've already run.
create or replace function public.start_webinar(p_webinar_id uuid)
returns public.webinar_status
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status public.webinar_status;
begin
  select status into v_status from public.webinars
  where id = p_webinar_id and host_id = auth.uid()
  for update;
  if not found then
    raise exception 'webinar_not_found' using errcode = 'P0001';
  end if;
  if v_status = 'live' then
    return v_status;
  end if;
  if v_status not in ('draft', 'scheduled') then
    raise exception 'invalid_status_transition' using errcode = 'P0001';
  end if;
  if public.user_plan(auth.uid()) = 'free' and exists (
    select 1 from public.webinar_usage u where u.host_id = auth.uid() and u.webinar_id <> p_webinar_id
  ) then
    raise exception 'plan_webinar_limit' using errcode = 'P0001';
  end if;

  insert into public.webinar_usage (webinar_id, host_id) values (p_webinar_id, auth.uid())
  on conflict do nothing;
  update public.webinars set status = 'live', started_at = now() where id = p_webinar_id;
  return 'live';
end;
$$;

-- ---------------------------------------------------------------------------
-- Attendee cap
-- ---------------------------------------------------------------------------

create or replace function public.get_public_webinar(p_webinar_id uuid)
returns table (
  id                uuid,
  title             text,
  description       text,
  starts_at         timestamptz,
  duration_minutes  integer,
  timezone          text,
  status            public.webinar_status,
  requires_approval boolean,
  host_name         text,
  is_full           boolean,
  custom_fields     jsonb,
  registered_count  integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with counts as (
    select count(*)::integer as n
    from public.registrations r
    where r.webinar_id = p_webinar_id and r.status in ('pending', 'approved')
  )
  select
    w.id, w.title, w.description, w.starts_at, w.duration_minutes, w.timezone,
    w.status, w.requires_approval,
    p.full_name,
    coalesce(c.n >= public.webinar_attendee_limit(w), false),
    w.custom_fields,
    c.n
  from public.webinars w
  join public.profiles p on p.id = w.host_id
  cross join counts c
  where w.id = p_webinar_id
    and w.status <> 'draft';
$$;

create or replace function public.register_for_webinar(
  p_webinar_id uuid,
  p_email      text,
  p_full_name  text,
  p_answers    jsonb default '{}'::jsonb
)
returns table (registration_id uuid, registration_status public.registration_status)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_webinar  public.webinars%rowtype;
  v_user_id  uuid := auth.uid();
  v_email    text := lower(trim(p_email));
  v_existing public.registrations%rowtype;
  v_has_existing boolean;
  v_taken    integer;
  v_limit    integer;
  v_status   public.registration_status;
  v_id       uuid;
  v_field    jsonb;
  v_answer   jsonb;
  v_answers  jsonb := '{}'::jsonb;
begin
  if v_user_id is not null then
    select lower(u.email) into v_email from auth.users u where u.id = v_user_id;
  end if;

  select * into v_webinar from public.webinars w where w.id = p_webinar_id for update;
  if not found or v_webinar.status = 'draft' then
    raise exception 'webinar_not_found' using errcode = 'P0001';
  end if;
  if v_webinar.status not in ('scheduled', 'live') then
    raise exception 'registration_closed' using errcode = 'P0001';
  end if;

  for v_field in select * from jsonb_array_elements(v_webinar.custom_fields) loop
    v_answer := coalesce(p_answers, '{}'::jsonb) -> (v_field ->> 'id');
    if v_answer is not null and jsonb_typeof(v_answer) in ('string', 'boolean') then
      if jsonb_typeof(v_answer) = 'string' and char_length(v_answer #>> '{}') > 1000 then
        raise exception 'invalid_answers' using errcode = 'P0001';
      end if;
      v_answers := v_answers || jsonb_build_object(v_field ->> 'id', v_answer);
    end if;
    if coalesce((v_field ->> 'required')::boolean, false) and (
         v_answer is null
         or (jsonb_typeof(v_answer) = 'string' and btrim(v_answer #>> '{}') = '')
         or v_answer = 'false'::jsonb
       ) then
      raise exception 'missing_required_answers' using errcode = 'P0001';
    end if;
  end loop;

  select * into v_existing from public.registrations r
  where r.webinar_id = p_webinar_id and lower(r.email) = v_email;
  v_has_existing := found;
  if v_has_existing and v_existing.status <> 'cancelled' then
    if v_user_id is not null and v_existing.user_id is null then
      update public.registrations set user_id = v_user_id where id = v_existing.id;
    end if;
    return query select v_existing.id, v_existing.status;
    return;
  end if;

  v_limit := public.webinar_attendee_limit(v_webinar);
  if v_limit is not null then
    select count(*) into v_taken from public.registrations r
    where r.webinar_id = p_webinar_id and r.status in ('pending', 'approved');
    if v_taken >= v_limit then
      raise exception 'webinar_full' using errcode = 'P0001';
    end if;
  end if;

  v_status := case when v_webinar.requires_approval then 'pending' else 'approved' end;

  if v_has_existing then
    update public.registrations
      set status = v_status, full_name = trim(p_full_name), answers = v_answers,
          user_id = coalesce(v_user_id, user_id)
      where id = v_existing.id
      returning id into v_id;
  else
    insert into public.registrations (webinar_id, user_id, email, full_name, status, answers)
    values (p_webinar_id, v_user_id, v_email, trim(p_full_name), v_status, v_answers)
    returning id into v_id;
  end if;

  return query select v_id, v_status;
end;
$$;

-- Re-approving a rejected or cancelled registrant counts against the cap.
create function public.enforce_registration_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_webinar public.webinars%rowtype;
  v_limit   integer;
begin
  if new.status in ('approved', 'pending') and old.status not in ('approved', 'pending') then
    select * into v_webinar from public.webinars w where w.id = new.webinar_id for update;
    v_limit := public.webinar_attendee_limit(v_webinar);
    if v_limit is not null and (
      select count(*) from public.registrations r
      where r.webinar_id = new.webinar_id and r.status in ('pending', 'approved') and r.id <> new.id
    ) >= v_limit then
      raise exception 'webinar_full' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger registrations_enforce_cap
  before update of status on public.registrations
  for each row execute function public.enforce_registration_cap();

-- ---------------------------------------------------------------------------
-- Room additions
-- ---------------------------------------------------------------------------

alter table public.webinars
  add column is_recording          boolean not null default false,
  add column spotlight_question_id uuid references public.room_questions (id) on delete set null;

alter table public.room_questions
  add column answered_at timestamptz;

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
    'spotlightQuestionId', w.spotlight_question_id
  );
$$;

create or replace function public.room_question_json(p_question_id uuid, p_viewer uuid)
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
    'answeredAt', q.answered_at,
    'upvotes', (select count(*) from public.room_question_upvotes u where u.question_id = q.id),
    'upvotedByMe', p_viewer is not null and exists (
      select 1 from public.room_question_upvotes u where u.question_id = q.id and u.user_id = p_viewer
    )
  )
  from public.room_questions q
  where q.id = p_question_id;
$$;

-- Adds recording (bool) and spotlightQuestionId (uuid of a question in this
-- webinar, or null) to the keys the host can change.
create or replace function public.update_room_settings(p_webinar_id uuid, p_settings jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key     text;
  v_webinar public.webinars%rowtype;
  v_spot    uuid;
begin
  if public.webinar_role(p_webinar_id) is distinct from 'host' then
    perform public.room_fail('forbidden', 'Only the host can change settings.');
  end if;
  if jsonb_typeof(p_settings) is distinct from 'object' or p_settings = '{}'::jsonb then
    perform public.room_fail('invalid_payload', 'Provide at least one setting.');
  end if;
  for v_key in select jsonb_object_keys(p_settings) loop
    if v_key in ('chatEnabled', 'qnaEnabled', 'reactionsEnabled', 'handRaiseEnabled', 'recording') then
      if jsonb_typeof(p_settings -> v_key) <> 'boolean' then
        perform public.room_fail('invalid_payload', format('%s must be true or false.', v_key));
      end if;
    elsif v_key = 'slowModeSeconds' then
      if jsonb_typeof(p_settings -> v_key) <> 'number'
         or (p_settings ->> v_key)::numeric not between 0 and 300
         or (p_settings ->> v_key)::numeric <> trunc((p_settings ->> v_key)::numeric) then
        perform public.room_fail('invalid_payload', 'Slow mode must be 0 to 300 seconds.');
      end if;
    elsif v_key = 'spotlightQuestionId' then
      if jsonb_typeof(p_settings -> v_key) = 'string' then
        select q.id into v_spot from public.room_questions q
        where q.webinar_id = p_webinar_id and q.id::text = p_settings ->> v_key;
        if v_spot is null then
          perform public.room_fail('invalid_payload', 'Question not found.');
        end if;
      elsif jsonb_typeof(p_settings -> v_key) <> 'null' then
        perform public.room_fail('invalid_payload', 'spotlightQuestionId must be a question id or null.');
      end if;
    else
      perform public.room_fail('invalid_payload', format('Unknown setting %s.', v_key));
    end if;
  end loop;

  update public.webinars w set
    chat_enabled          = coalesce((p_settings ->> 'chatEnabled')::boolean, w.chat_enabled),
    qna_enabled           = coalesce((p_settings ->> 'qnaEnabled')::boolean, w.qna_enabled),
    reactions_enabled     = coalesce((p_settings ->> 'reactionsEnabled')::boolean, w.reactions_enabled),
    hand_raise_enabled    = coalesce((p_settings ->> 'handRaiseEnabled')::boolean, w.hand_raise_enabled),
    slow_mode_seconds     = coalesce((p_settings ->> 'slowModeSeconds')::integer, w.slow_mode_seconds),
    is_recording          = coalesce((p_settings ->> 'recording')::boolean, w.is_recording),
    spotlight_question_id = case when p_settings ? 'spotlightQuestionId' then v_spot else w.spotlight_question_id end
  where w.id = p_webinar_id
  returning * into v_webinar;

  perform public.room_broadcast(p_webinar_id, 'webinar_settings:settings_updated', public.room_settings_json(v_webinar));
  return public.room_settings_json(v_webinar);
end;
$$;

-- Host marks a question answered (or not). Answering a spotlighted question
-- takes it off the stage.
create function public.set_question_answered(p_question_id uuid, p_answered boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_question public.room_questions%rowtype;
  v_webinar  public.webinars%rowtype;
begin
  select * into v_question from public.room_questions q where q.id = p_question_id;
  if not found or public.webinar_role(v_question.webinar_id) is distinct from 'host' then
    perform public.room_fail('forbidden', 'Only the host can answer questions.');
  end if;

  update public.room_questions
    set answered_at = case when p_answered then coalesce(answered_at, now()) end
    where id = p_question_id;

  if p_answered then
    update public.webinars set spotlight_question_id = null
    where id = v_question.webinar_id and spotlight_question_id = p_question_id
    returning * into v_webinar;
    if found then
      perform public.room_broadcast(v_question.webinar_id, 'webinar_settings:settings_updated', public.room_settings_json(v_webinar));
    end if;
  end if;

  perform public.room_broadcast(v_question.webinar_id, 'qna:question_updated', public.room_question_json(p_question_id, null));
  return public.room_question_json(p_question_id, auth.uid());
end;
$$;

-- Host removes an attendee: their registration is rejected, so they can't
-- rejoin or write, and their client is told to leave right away.
create function public.remove_room_attendee(p_webinar_id uuid, p_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if public.webinar_role(p_webinar_id) is distinct from 'host' then
    perform public.room_fail('forbidden', 'Only the host can remove attendees.');
  end if;
  if p_user_id = auth.uid() then
    perform public.room_fail('invalid_payload', 'You can''t remove yourself.');
  end if;
  update public.registrations set status = 'rejected'
  where webinar_id = p_webinar_id and user_id = p_user_id;
  perform public.room_broadcast(p_webinar_id, 'attendee:removed', jsonb_build_object('userId', p_user_id));
end;
$$;

-- Ending the webinar also clears the recording indicator and spotlight.
create or replace function public.end_webinar(p_webinar_id uuid)
returns public.webinar_status
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status public.webinar_status;
begin
  select status into v_status from public.webinars
  where id = p_webinar_id and host_id = auth.uid()
  for update;
  if not found then
    raise exception 'webinar_not_found' using errcode = 'P0001';
  end if;
  if v_status = 'ended' then
    return v_status;
  end if;
  if v_status <> 'live' then
    raise exception 'invalid_status_transition' using errcode = 'P0001';
  end if;
  update public.webinars
    set status = 'ended', ended_at = now(), is_recording = false, spotlight_question_id = null
    where id = p_webinar_id;
  return 'ended';
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function
  public.user_plan(uuid),
  public.plan_attendee_cap(text),
  public.webinar_attendee_limit(public.webinars),
  public.get_my_plan(),
  public.enforce_webinar_plan_limit(),
  public.enforce_registration_cap(),
  public.set_question_answered(uuid, boolean),
  public.remove_room_attendee(uuid, uuid)
from public, anon, authenticated;

grant execute on function
  public.get_my_plan(),
  public.set_question_answered(uuid, boolean),
  public.remove_room_attendee(uuid, uuid)
to authenticated;

-- create or replace keeps existing grants, but restate the client-facing ones.
grant execute on function public.start_webinar(uuid) to authenticated;
grant execute on function public.end_webinar(uuid) to authenticated;
grant execute on function public.get_public_webinar(uuid) to anon, authenticated;
grant execute on function public.register_for_webinar(uuid, text, text, jsonb) to anon, authenticated;
grant execute on function public.update_room_settings(uuid, jsonb) to authenticated;
