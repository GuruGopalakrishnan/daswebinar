-- Email notifications (sent through Resend by the app, see src/lib/email/).
--
--   confirmation   when a registration is approved (on register, or when the host approves)
--   reminder_24h   about a day before (only for people who registered before that)
--   reminder_1h    about an hour before
--   live           when the host goes live
--
-- email_log is the "already sent" ledger. The primary key makes each email
-- go out at most once per registration, even if the API and the scheduled job
-- race: a sender first claims rows (insert ... on conflict do nothing), sends
-- only what it claimed, and deletes its claims again if the send fails.

create type public.email_kind as enum ('confirmation', 'reminder_24h', 'reminder_1h', 'live');

create table public.email_log (
  registration_id uuid not null references public.registrations (id) on delete cascade,
  kind            public.email_kind not null,
  sent_at         timestamptz not null default now(),
  primary key (registration_id, kind)
);

-- Service role only: no policies, no grants.
alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;

-- The scheduled job looks up upcoming and just-started webinars.
create index webinars_status_starts_idx on public.webinars (status, starts_at);
