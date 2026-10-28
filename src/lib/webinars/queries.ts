import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  RECORDING_COLUMNS,
  REGISTRATION_COLUMNS,
  WEBINAR_COLUMNS,
  toPublicWebinarDto,
  toRecordingDto,
  toRegistrationDto,
  toWebinarDto,
} from "./dto";
import type { PublicWebinarRow, RecordingRow, RegistrationRow, RegistrationStatus, WebinarRow, WebinarStatus } from "./types";

// All reads use the signed-in user's session; RLS decides visibility.

export async function listHostWebinars(hostId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("webinars")
    .select(`${WEBINAR_COLUMNS}, registrations(count)`)
    .eq("host_id", hostId)
    .order("starts_at", { ascending: true })
    .overrideTypes<(WebinarRow & { registrations: { count: number }[] })[], { merge: false }>();
  if (error) throw error;
  return data.map((row) => ({
    ...toWebinarDto(row),
    registrationCount: row.registrations[0]?.count ?? 0,
  }));
}

export type HostWebinarListItem = Awaited<ReturnType<typeof listHostWebinars>>[number];

/** The full record if the current user hosts it, otherwise null. */
export async function getHostWebinar(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("webinars")
    .select(WEBINAR_COLUMNS)
    .eq("id", id)
    .overrideTypes<WebinarRow[], { merge: false }>();
  if (error) throw error;
  return data[0] ? toWebinarDto(data[0]) : null;
}

/** Public view (non-draft only), available to anyone. */
export async function getPublicWebinar(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_webinar", { p_webinar_id: id });
  if (error) throw error;
  const row = (data as PublicWebinarRow[] | null)?.[0];
  return row ? toPublicWebinarDto(row) : null;
}

export async function listRegistrations(webinarId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .select(REGISTRATION_COLUMNS)
    .eq("webinar_id", webinarId)
    .order("created_at", { ascending: false })
    .limit(500)
    .overrideTypes<RegistrationRow[], { merge: false }>();
  if (error) throw error;
  return data.map(toRegistrationDto);
}

/** The current user's own registration for a webinar, if any. */
export async function getMyRegistration(webinarId: string, userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .select(REGISTRATION_COLUMNS)
    .eq("webinar_id", webinarId)
    .eq("user_id", userId)
    .overrideTypes<RegistrationRow[], { merge: false }>();
  if (error) throw error;
  return data[0] ? toRegistrationDto(data[0]) : null;
}

export async function listRecordings(webinarId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recordings")
    .select(RECORDING_COLUMNS)
    .eq("webinar_id", webinarId)
    .order("created_at", { ascending: false })
    .overrideTypes<RecordingRow[], { merge: false }>();
  if (error) throw error;
  return data.map(toRecordingDto);
}

export async function getRecording(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recordings")
    .select(RECORDING_COLUMNS)
    .eq("id", id)
    .overrideTypes<RecordingRow[], { merge: false }>();
  if (error) throw error;
  return data[0] ? toRecordingDto(data[0]) : null;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// ---------------------------------------------------------------------------
// Event slugs and My events (migration 20261030000000_event_slugs.sql)
// ---------------------------------------------------------------------------
// These tolerate a database where that migration hasn't been applied yet: they behave as "not found" /
// "nothing yet" instead of failing, so deploying the app before the migration can't break existing pages.

/** PostgREST "function not found" / Postgres "undefined column": the slug migration isn't applied. */
function isMissingSlugMigration(error: { code?: string } | null) {
  return error?.code === "PGRST202" || error?.code === "42703" || error?.code === "42883";
}

/** Public, non-draft webinar by its friendly slug. Unlisted webinars never resolve here. Deduplicated per request. */
export const getPublicWebinarBySlug = cache(async (slug: string) => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/i.test(slug) || slug.length > 64) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_webinar_by_slug", { p_slug: slug });
  if (error) {
    if (isMissingSlugMigration(error)) return null;
    throw error;
  }
  const row = (data as PublicWebinarRow[] | null)?.[0];
  return row ? toPublicWebinarDto(row) : null;
});

/** The host's own webinar slug (RLS: host only), or null if there is none yet. */
export async function getHostWebinarSlug(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("webinars").select("slug").eq("id", id).maybeSingle<{ slug: string }>();
  if (error) {
    if (isMissingSlugMigration(error)) return null;
    throw error;
  }
  return data?.slug ?? null;
}

export type MyRegistration = {
  registrationId: string;
  registrationStatus: RegistrationStatus;
  registeredAt: string;
  webinarId: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  timezone: string;
  webinarStatus: WebinarStatus;
  hostName: string | null;
};

/** The signed-in user's (account or guest session) own registrations. `available: false` before the migration. */
export async function listMyRegistrations(): Promise<{ available: boolean; items: MyRegistration[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_registrations");
  if (error) {
    if (isMissingSlugMigration(error)) return { available: false, items: [] };
    throw error;
  }
  type Row = {
    registration_id: string;
    registration_status: RegistrationStatus;
    registered_at: string;
    webinar_id: string;
    title: string;
    starts_at: string;
    duration_minutes: number;
    timezone: string;
    webinar_status: WebinarStatus;
    host_name: string | null;
  };
  return {
    available: true,
    items: ((data as Row[] | null) ?? []).map((r) => ({
      registrationId: r.registration_id,
      registrationStatus: r.registration_status,
      registeredAt: r.registered_at,
      webinarId: r.webinar_id,
      title: r.title,
      startsAt: r.starts_at,
      durationMinutes: r.duration_minutes,
      timezone: r.timezone,
      webinarStatus: r.webinar_status,
      hostName: r.host_name,
    })),
  };
}
