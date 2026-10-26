-- Custom registration fields, webinar lifecycle (start/end), recordings.

-- ---------------------------------------------------------------------------
-- Custom registration fields
-- ---------------------------------------------------------------------------
-- custom_fields: [{ id, label, type: text|textarea|select|checkbox, required, options[] }]
-- Shape is validated by the API (zod); the database enforces the envelope.

alter table public.webinars
  add column custom_fields jsonb not null default '[]'::jsonb
    check (jsonb_typeof(custom_fields) = 'array' and jsonb_array_length(custom_fields) <= 10),
  add column started_at timestamptz,
  add column ended_at timestamptz;

grant update (custom_fields) on public.webinars to authenticated;

alter table public.registrations
  add column answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(answers) = 'object');

-- ---------------------------------------------------------------------------
-- Public view now includes the registration form definition
-- ---------------------------------------------------------------------------

drop function public.get_public_webinar(uuid);

create function public.get_public_webinar(p_webinar_id uuid)
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
    w.capacity is not null and c.n >= w.capacity,
    w.custom_fields,
    c.n
  from public.webinars w
  join public.profiles p on p.id = w.host_id
  cross join counts c
  where w.id = p_webinar_id
    and w.status <> 'draft';
$$;

revoke execute on function public.get_public_webinar(uuid) from public;
grant execute on function public.get_public_webinar(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Registration with answers (replaces the 3-argument version)
-- ---------------------------------------------------------------------------

drop function public.register_for_webinar(uuid, text, text);

create function public.register_for_webinar(
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

  -- Keep only answers to defined fields; enforce required ones.
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
    -- A guest who later signs up with the same (verified) email gets their
    -- registration linked to the account so they can join the room.
    if v_user_id is not null and v_existing.user_id is null then
      update public.registrations set user_id = v_user_id where id = v_existing.id;
    end if;
    return query select v_existing.id, v_existing.status;
    return;
  end if;

  if v_webinar.capacity is not null then
    select count(*) into v_taken from public.registrations r
    where r.webinar_id = p_webinar_id and r.status in ('pending', 'approved');
    if v_taken >= v_webinar.capacity then
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

revoke execute on function public.register_for_webinar(uuid, text, text, jsonb) from public;
grant execute on function public.register_for_webinar(uuid, text, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lifecycle: only the host, only valid transitions
-- ---------------------------------------------------------------------------

create function public.start_webinar(p_webinar_id uuid)
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
  update public.webinars set status = 'live', started_at = now() where id = p_webinar_id;
  return 'live';
end;
$$;

create function public.end_webinar(p_webinar_id uuid)
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
  update public.webinars set status = 'ended', ended_at = now() where id = p_webinar_id;
  return 'ended';
end;
$$;

revoke execute on function public.start_webinar(uuid) from public;
revoke execute on function public.end_webinar(uuid) from public;
grant execute on function public.start_webinar(uuid) to authenticated;
grant execute on function public.end_webinar(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Recordings
-- ---------------------------------------------------------------------------

create table public.recordings (
  id               uuid primary key default gen_random_uuid(),
  webinar_id       uuid not null references public.webinars (id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 200),
  video_url        text not null check (video_url ~ '^https://' and char_length(video_url) <= 2048),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  created_at       timestamptz not null default now()
);

create index recordings_webinar_idx on public.recordings (webinar_id, created_at desc);

alter table public.recordings enable row level security;

create policy "recordings: host or approved registrant can read"
  on public.recordings for select
  to authenticated
  using (
    exists (
      select 1 from public.webinars w
      where w.id = webinar_id and w.host_id = (select auth.uid())
    )
    or exists (
      select 1 from public.registrations r
      where r.webinar_id = recordings.webinar_id
        and r.user_id = (select auth.uid())
        and r.status = 'approved'
    )
  );

create policy "recordings: host can insert"
  on public.recordings for insert
  to authenticated
  with check (exists (
    select 1 from public.webinars w
    where w.id = webinar_id and w.host_id = (select auth.uid())
  ));

create policy "recordings: host can delete"
  on public.recordings for delete
  to authenticated
  using (exists (
    select 1 from public.webinars w
    where w.id = webinar_id and w.host_id = (select auth.uid())
  ));

revoke update on public.recordings from anon, authenticated;
