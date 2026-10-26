-- Webinars and registrations.
--
-- Access model:
--   * webinars table: hosts read/write only their own rows (RLS). Public pages
--     read through get_public_webinar(), which returns a safe subset, so
--     unlisted webinars can't be enumerated with the public API key.
--   * registrations: created only through register_for_webinar() (capacity is
--     checked under a row lock). Hosts can read and approve/reject; registrants
--     can read their own.
--   * live/ended are reserved for the server-side lifecycle (phase 4).

-- Backfill profiles for users who signed up before the profiles trigger
-- existed; webinars.host_id references profiles.
insert into public.profiles (id, full_name)
select u.id, left(u.raw_user_meta_data ->> 'full_name', 100)
from auth.users u
on conflict (id) do nothing;

create type public.webinar_status as enum ('draft', 'scheduled', 'live', 'ended', 'cancelled');
create type public.webinar_visibility as enum ('public', 'unlisted');
create type public.registration_status as enum ('pending', 'approved', 'rejected', 'cancelled');

-- ---------------------------------------------------------------------------
-- webinars
-- ---------------------------------------------------------------------------

create table public.webinars (
  id                uuid primary key default gen_random_uuid(),
  host_id           uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title             text not null check (char_length(title) between 1 and 200),
  description       text check (char_length(description) <= 5000),
  starts_at         timestamptz not null,
  duration_minutes  integer not null default 60 check (duration_minutes between 5 and 720),
  timezone          text not null default 'UTC' check (char_length(timezone) <= 64),
  status            public.webinar_status not null default 'draft',
  visibility        public.webinar_visibility not null default 'unlisted',
  requires_approval boolean not null default false,
  capacity          integer check (capacity is null or capacity between 1 and 100000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index webinars_host_starts_idx on public.webinars (host_id, starts_at desc);
create index webinars_public_upcoming_idx on public.webinars (starts_at)
  where visibility = 'public' and status in ('scheduled', 'live');

create trigger webinars_set_updated_at
  before update on public.webinars
  for each row execute function public.set_updated_at();

alter table public.webinars enable row level security;

create policy "webinars: host can read"
  on public.webinars for select
  to authenticated
  using ((select auth.uid()) = host_id);

create policy "webinars: host can create"
  on public.webinars for insert
  to authenticated
  with check ((select auth.uid()) = host_id and status in ('draft', 'scheduled'));

create policy "webinars: host can update"
  on public.webinars for update
  to authenticated
  using ((select auth.uid()) = host_id)
  with check ((select auth.uid()) = host_id);

create policy "webinars: host can delete"
  on public.webinars for delete
  to authenticated
  using ((select auth.uid()) = host_id);

-- Hosts may edit content fields only; id/host_id/timestamps are immutable.
revoke update on public.webinars from anon, authenticated;
grant update (title, description, starts_at, duration_minutes, timezone, status,
              visibility, requires_approval, capacity)
  on public.webinars to authenticated;

-- Clients can't move a webinar into or out of live/ended. Server-side
-- lifecycle functions (security definer, phase 4) run as the table owner
-- and are not affected.
create function public.guard_webinar_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and current_user in ('anon', 'authenticated')
     and (new.status in ('live', 'ended') or old.status in ('live', 'ended')) then
    raise exception 'invalid_status_transition'
      using errcode = 'P0001',
            hint = format('%s -> %s is managed by the server', old.status, new.status);
  end if;
  return new;
end;
$$;

create trigger webinars_guard_status
  before update of status on public.webinars
  for each row execute function public.guard_webinar_status();

-- ---------------------------------------------------------------------------
-- registrations
-- ---------------------------------------------------------------------------

create table public.registrations (
  id          uuid primary key default gen_random_uuid(),
  webinar_id  uuid not null references public.webinars (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete set null,
  email       text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name   text not null check (char_length(full_name) between 1 and 100),
  status      public.registration_status not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index registrations_webinar_email_key on public.registrations (webinar_id, lower(email));
create index registrations_user_idx on public.registrations (user_id);
create index registrations_webinar_status_idx on public.registrations (webinar_id, status);

create trigger registrations_set_updated_at
  before update on public.registrations
  for each row execute function public.set_updated_at();

alter table public.registrations enable row level security;

create policy "registrations: host or registrant can read"
  on public.registrations for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.webinars w
      where w.id = webinar_id and w.host_id = (select auth.uid())
    )
  );

create policy "registrations: host can update"
  on public.registrations for update
  to authenticated
  using (exists (
    select 1 from public.webinars w
    where w.id = webinar_id and w.host_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.webinars w
    where w.id = webinar_id and w.host_id = (select auth.uid())
  ));

-- Hosts change status only. No insert/delete policies: inserts go through
-- register_for_webinar(), deletes cascade from the webinar.
revoke update on public.registrations from anon, authenticated;
grant update (status) on public.registrations to authenticated;

-- ---------------------------------------------------------------------------
-- Public read + registration RPCs
-- ---------------------------------------------------------------------------

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
  is_full           boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    w.id, w.title, w.description, w.starts_at, w.duration_minutes, w.timezone,
    w.status, w.requires_approval,
    p.full_name,
    w.capacity is not null and (
      select count(*) from public.registrations r
      where r.webinar_id = w.id and r.status in ('pending', 'approved')
    ) >= w.capacity
  from public.webinars w
  join public.profiles p on p.id = w.host_id
  where w.id = p_webinar_id
    and w.status <> 'draft';
$$;

create function public.register_for_webinar(
  p_webinar_id uuid,
  p_email      text,
  p_full_name  text
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
begin
  -- Signed-in users always register as themselves.
  if v_user_id is not null then
    select lower(u.email) into v_email from auth.users u where u.id = v_user_id;
  end if;

  -- Lock the webinar row so concurrent registrations can't overshoot capacity.
  select * into v_webinar from public.webinars w where w.id = p_webinar_id for update;
  if not found or v_webinar.status = 'draft' then
    raise exception 'webinar_not_found' using errcode = 'P0001';
  end if;
  if v_webinar.status not in ('scheduled', 'live') then
    raise exception 'registration_closed' using errcode = 'P0001';
  end if;

  -- Idempotent: re-registering returns the existing registration.
  select * into v_existing from public.registrations r
  where r.webinar_id = p_webinar_id and lower(r.email) = v_email;
  -- Capture now: later SELECT INTO statements overwrite FOUND.
  v_has_existing := found;
  if v_has_existing and v_existing.status <> 'cancelled' then
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
    -- Previously cancelled: reactivate.
    update public.registrations
      set status = v_status, full_name = trim(p_full_name), user_id = coalesce(v_user_id, user_id)
      where id = v_existing.id
      returning id into v_id;
  else
    insert into public.registrations (webinar_id, user_id, email, full_name, status)
    values (p_webinar_id, v_user_id, v_email, trim(p_full_name), v_status)
    returning id into v_id;
  end if;

  return query select v_id, v_status;
end;
$$;

revoke execute on function public.get_public_webinar(uuid) from public;
revoke execute on function public.register_for_webinar(uuid, text, text) from public;
grant execute on function public.get_public_webinar(uuid) to anon, authenticated;
grant execute on function public.register_for_webinar(uuid, text, text) to anon, authenticated;
