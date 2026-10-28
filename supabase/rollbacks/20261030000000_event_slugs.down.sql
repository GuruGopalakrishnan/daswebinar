-- Rollback for migrations/20261030000000_event_slugs.sql. Run by hand (SQL editor or psql), only after the
-- app no longer calls get_public_webinar_by_slug / list_my_registrations. Not in migrations/, so
-- `supabase db push` never applies it. Webinar ids, registrations and join tokens are untouched.
-- /e/<slug> links stop working; /register/<id> and /join/<token> keep working.

drop function if exists public.list_my_registrations();
drop function if exists public.get_public_webinar_by_slug(text);
drop trigger if exists webinars_slug_guard on public.webinars;
drop function if exists public.webinars_slug_guard();
drop index if exists public.webinars_slug_key;
alter table public.webinars drop constraint if exists webinars_slug_format;
alter table public.webinars drop column if exists slug;
drop function if exists public.next_webinar_slug(text, uuid);
drop function if exists public.slugify(text);
