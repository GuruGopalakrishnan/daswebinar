import type { SupabaseClient } from "@supabase/supabase-js";
import type { Ack } from "./protocol";

/**
 * Calls a live-room database function and maps its errors to Ack. Room
 * functions raise `message = code` (e.g. slow_mode) and `detail = text for
 * the user`; anything else becomes a generic error.
 */
export async function roomRpc<T>(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<Ack<T>> {
  const { data, error } = await supabase.rpc(fn, args);
  if (!error) return { ok: true, data: data as T };
  if (error.details && /^[a-z_]+$/.test(error.message)) {
    return { ok: false, error: { code: error.message, message: error.details } };
  }
  return { ok: false, error: { code: "internal_error", message: "Couldn't reach the room. Try again." } };
}
