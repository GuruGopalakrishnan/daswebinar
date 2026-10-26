import "server-only";
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
import type { PublicWebinarRow, RecordingRow, RegistrationRow, WebinarRow } from "./types";

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
