import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { BATCH_LIMIT, resendConfig, sendBatch, sendEmail, type ResendConfig } from "./resend";
import { renderEmail, type EmailContext, type EmailKind } from "./templates";

/**
 * Email notifications. Everything here runs with the service role (no user
 * session: the scheduled job, or after() once the response is sent) and never
 * throws: a failed email must not break registering or going live.
 *
 * At-most-once per (registration, kind) comes from public.email_log: claim the
 * rows, send what was claimed, release the claims if the send fails.
 */

type WebinarRow = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  duration_minutes: number;
  timezone: string;
  status: string;
  host_id: string;
};

type RegistrationRow = {
  id: string;
  webinar_id: string;
  email: string;
  full_name: string;
  join_token: string;
  created_at: string;
};

const WEBINAR_COLUMNS = "id, title, description, starts_at, duration_minutes, timezone, status, host_id";
const REGISTRATION_COLUMNS = "id, webinar_id, email, full_name, join_token, created_at";
const PAGE = 1000;
/** Resend's default limit is 2 requests per second. */
const PAUSE_MS = 600;

const HOUR = 60 * 60 * 1000;

function setup(): { config: ResendConfig; admin: SupabaseClient } | null {
  const config = resendConfig();
  if (!config) {
    console.warn("Email skipped: RESEND_API_KEY or EMAIL_FROM is not set.");
    return null;
  }
  try {
    return { config, admin: createAdminClient() };
  } catch (error) {
    console.warn("Email skipped:", (error as Error).message);
    return null;
  }
}

async function hostNames(admin: SupabaseClient, webinars: WebinarRow[]) {
  const ids = [...new Set(webinars.map((w) => w.host_id))];
  if (!ids.length) return new Map<string, string | null>();
  const { data, error } = await admin.from("profiles").select("id, full_name").in("id", ids);
  if (error) throw error;
  return new Map((data as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name?.trim() || null]));
}

/** All approved registrations for these webinars, paged past PostgREST's row cap. */
async function approvedRegistrations(admin: SupabaseClient, webinarIds: string[]) {
  const rows: RegistrationRow[] = [];
  if (!webinarIds.length) return rows;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("registrations")
      .select(REGISTRATION_COLUMNS)
      .in("webinar_id", webinarIds)
      .eq("status", "approved")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data as RegistrationRow[]));
    if (data.length < PAGE) return rows;
  }
}

function context(siteUrl: string, w: WebinarRow, r: RegistrationRow, host: string | null): EmailContext {
  return {
    to: r.email,
    attendeeName: r.full_name,
    joinUrl: `${siteUrl}/join/${r.join_token}`,
    webinar: {
      id: w.id,
      title: w.title,
      description: w.description,
      startsAt: w.starts_at,
      durationMinutes: w.duration_minutes,
      timezone: w.timezone,
      hostName: host,
    },
  };
}

/** Claims (registration, kind) rows; returns the ids this call now owns. */
async function claim(admin: SupabaseClient, kind: EmailKind, ids: string[]) {
  const { data, error } = await admin
    .from("email_log")
    .upsert(
      ids.map((id) => ({ registration_id: id, kind })),
      { onConflict: "registration_id,kind", ignoreDuplicates: true },
    )
    .select("registration_id");
  if (error) throw error;
  return new Set((data as { registration_id: string }[]).map((r) => r.registration_id));
}

async function release(admin: SupabaseClient, kind: EmailKind, ids: string[]) {
  const { error } = await admin.from("email_log").delete().eq("kind", kind).in("registration_id", ids);
  if (error) console.error("Couldn't release email claims; those emails won't be retried", kind, error);
}

function idempotencyKey(kind: EmailKind, ids: string[]) {
  return `${kind}-${createHash("sha256").update([...ids].sort().join(",")).digest("hex")}`;
}

/** Sends `kind` to every recipient not emailed yet. Returns how many were sent. */
async function deliver(
  config: ResendConfig,
  admin: SupabaseClient,
  kind: EmailKind,
  recipients: { registrationId: string; context: EmailContext }[],
) {
  let sent = 0;
  for (let i = 0; i < recipients.length; i += BATCH_LIMIT) {
    const chunk = recipients.slice(i, i + BATCH_LIMIT);
    const owned = await claim(admin, kind, chunk.map((r) => r.registrationId));
    const mine = chunk.filter((r) => owned.has(r.registrationId));
    if (!mine.length) continue;

    const ids = mine.map((r) => r.registrationId);
    try {
      const emails = mine.map((r) => renderEmail(kind, r.context));
      if (emails.length === 1) await sendEmail(config, emails[0]!, idempotencyKey(kind, ids));
      else await sendBatch(config, emails, idempotencyKey(kind, ids));
      sent += mine.length;
    } catch (error) {
      console.error(`Sending ${kind} emails failed`, error);
      await release(admin, kind, ids);
    }
    if (i + BATCH_LIMIT < recipients.length) await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  return sent;
}

async function sendForWebinars(
  config: ResendConfig,
  admin: SupabaseClient,
  siteUrl: string,
  kind: EmailKind,
  webinars: WebinarRow[],
  include: (w: WebinarRow, r: RegistrationRow) => boolean = () => true,
) {
  if (!webinars.length) return 0;
  const [hosts, registrations] = await Promise.all([
    hostNames(admin, webinars),
    approvedRegistrations(admin, webinars.map((w) => w.id)),
  ]);
  const byId = new Map(webinars.map((w) => [w.id, w]));
  const recipients = registrations.flatMap((r) => {
    const w = byId.get(r.webinar_id);
    return w && include(w, r)
      ? [{ registrationId: r.id, context: context(siteUrl, w, r, hosts.get(w.host_id) ?? null) }]
      : [];
  });
  return deliver(config, admin, kind, recipients);
}

/** Confirmation with the personal join link and an .ics file. Call when a registration becomes approved. */
export async function notifyRegistrationApproved(registrationId: string, siteUrl: string) {
  const ready = setup();
  if (!ready) return;
  const { config, admin } = ready;
  try {
    const { data: registration, error } = await admin
      .from("registrations")
      .select(REGISTRATION_COLUMNS + ", status")
      .eq("id", registrationId)
      .maybeSingle<RegistrationRow & { status: string }>();
    if (error) throw error;
    if (registration?.status !== "approved") return;

    const { data: webinar, error: webinarError } = await admin
      .from("webinars")
      .select(WEBINAR_COLUMNS)
      .eq("id", registration.webinar_id)
      .in("status", ["scheduled", "live"])
      .maybeSingle<WebinarRow>();
    if (webinarError) throw webinarError;
    if (!webinar) return;

    const hosts = await hostNames(admin, [webinar]);
    await deliver(config, admin, "confirmation", [
      { registrationId, context: context(siteUrl, webinar, registration, hosts.get(webinar.host_id) ?? null) },
    ]);
  } catch (error) {
    console.error("Confirmation email failed", registrationId, error);
  }
}

/** "We're live" to every approved registrant. Call right after the webinar goes live. */
export async function notifyWebinarLive(webinarId: string, siteUrl: string) {
  const ready = setup();
  if (!ready) return;
  const { config, admin } = ready;
  try {
    const { data, error } = await admin.from("webinars").select(WEBINAR_COLUMNS).eq("id", webinarId).eq("status", "live");
    if (error) throw error;
    await sendForWebinars(config, admin, siteUrl, "live", data as WebinarRow[]);
  } catch (error) {
    console.error("Live emails failed", webinarId, error);
  }
}

/**
 * The scheduled job (every 5–10 minutes):
 *   24 h reminder: starts in 1–24 h, for people who registered at least 22 h before the start
 *   1 h reminder:  starts within the hour, for people who registered at least 90 min before the start
 *   live catch-up: went live in the last 30 min, in case the send at go-live time failed
 * Webinars that started early get the live email instead of the 1 h reminder.
 */
export async function sendScheduledEmails(siteUrl: string) {
  const ready = setup();
  if (!ready) return { configured: false as const };
  const { config, admin } = ready;
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();

  const [upcoming, live] = await Promise.all([
    admin
      .from("webinars")
      .select(WEBINAR_COLUMNS)
      .eq("status", "scheduled")
      .gt("starts_at", iso(now))
      .lte("starts_at", iso(now + 24 * HOUR)),
    admin
      .from("webinars")
      .select(WEBINAR_COLUMNS)
      .eq("status", "live")
      .gt("started_at", iso(now - 0.5 * HOUR)),
  ]);
  if (upcoming.error) throw upcoming.error;
  if (live.error) throw live.error;

  const soon = upcoming.data as WebinarRow[];
  const startsIn = (w: WebinarRow) => Date.parse(w.starts_at) - now;
  const registeredBefore = (w: WebinarRow, r: RegistrationRow, ms: number) =>
    Date.parse(r.created_at) <= Date.parse(w.starts_at) - ms;

  const reminder24h = await sendForWebinars(
    config, admin, siteUrl, "reminder_24h",
    soon.filter((w) => startsIn(w) > HOUR),
    (w, r) => registeredBefore(w, r, 22 * HOUR),
  );
  const reminder1h = await sendForWebinars(
    config, admin, siteUrl, "reminder_1h",
    soon.filter((w) => startsIn(w) <= HOUR),
    (w, r) => registeredBefore(w, r, 1.5 * HOUR),
  );
  const liveCatchUp = await sendForWebinars(config, admin, siteUrl, "live", live.data as WebinarRow[]);

  return { configured: true as const, reminder24h, reminder1h, liveCatchUp };
}
