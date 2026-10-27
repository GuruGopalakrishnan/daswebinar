-- Guest join: people who register without an account can enter the live room.
--
-- The register page signs a guest in anonymously (Supabase anonymous sign-ins,
-- Authentication -> Sign In / Providers -> "Allow anonymous sign-ins") before
-- registering. The registration is then tied to a real auth.uid(), so
-- webinar_role(), the channel policies and every room RPC work unchanged.
--
-- Each registration also gets a secret join_token. /join/<token> claims the
-- registration for whoever opens it, so the attendee can join from another
-- device (or the host can send the link by hand).
--
-- Anonymous users can never host webinars.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.is_anonymous_caller()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

create function public.is_anonymous_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select u.is_anonymous from auth.users u where u.id = p_user_id), false);
$$;

revoke execute on function public.is_anonymous_user(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Join tokens (existing registrations get one too)
-- ---------------------------------------------------------------------------

alter table public.registrations
  add column join_token uuid not null default gen_random_uuid();

create unique index registrations_join_token_key on public.registrations (join_token);

-- ---------------------------------------------------------------------------
-- Guests can't host
-- ---------------------------------------------------------------------------

create policy "webinars: guests can't create"
  on public.webinars as restrictive for insert
  to authenticated
  with check (not public.is_anonymous_caller());

-- ---------------------------------------------------------------------------
-- register_for_webinar: anonymous callers register with the email they type
-- ---------------------------------------------------------------------------

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
  v_is_anon  boolean := public.is_anonymous_caller();
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
  -- Accounts register under their verified email. Anonymous guests have none,
  -- so they use the one they typed, like signed-out guests.
  if v_user_id is not null and not v_is_anon then
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
    -- Link the caller to an existing registration:
    --   * an account (verified email) takes over one that is unlinked or held by a guest session
    --   * a guest only takes an unlinked one; a typed email proves nothing, so
    --     a guest can't push another guest out (the join link can)
    if v_user_id is not null and (
         v_existing.user_id is null
         or (not v_is_anon and public.is_anonymous_user(v_existing.user_id))
       ) then
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

-- ---------------------------------------------------------------------------
-- Join links
-- ---------------------------------------------------------------------------

-- What /join/<token> shows before anyone clicks Join. The token is the secret.
create function public.get_join_preview(p_token uuid)
returns table (
  webinar_id        uuid,
  title             text,
  starts_at         timestamptz,
  timezone          text,
  status            public.webinar_status,
  host_name         text,
  attendee_name     text,
  registration_status public.registration_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, w.title, w.starts_at, w.timezone, w.status, p.full_name, r.full_name, r.status
  from public.registrations r
  join public.webinars w on w.id = r.webinar_id
  join public.profiles p on p.id = w.host_id
  where r.join_token = p_token and w.status <> 'draft';
$$;

-- Ties the registration to the caller and returns the webinar id.
--   * unlinked, or held by a guest session: the caller takes it
--   * held by an account: only that account can use it
-- A guest's profile name is filled from the registration, so chat shows it.
create function public.claim_registration(p_token uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_reg public.registrations%rowtype;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;

  select * into v_reg from public.registrations r where r.join_token = p_token for update;
  if not found then
    raise exception 'invalid_join_link' using errcode = 'P0001';
  end if;

  if v_reg.user_id is distinct from v_uid then
    if v_reg.user_id is not null and not public.is_anonymous_user(v_reg.user_id) then
      raise exception 'join_link_claimed' using errcode = 'P0001';
    end if;
    update public.registrations set user_id = v_uid where id = v_reg.id;
  end if;

  if public.is_anonymous_caller() then
    update public.profiles
      set full_name = left(v_reg.full_name, 100)
      where id = v_uid and coalesce(btrim(full_name), '') = '';
  end if;

  return v_reg.webinar_id;
end;
$$;

revoke execute on function public.get_join_preview(uuid) from public;
revoke execute on function public.claim_registration(uuid) from public, anon;
grant execute on function public.get_join_preview(uuid) to anon, authenticated;
grant execute on function public.claim_registration(uuid) to authenticated;
