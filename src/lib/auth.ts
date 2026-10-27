import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Returns the verified user for this request, or null. Deduplicated per render. */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

/** Guests who registered without an account get an anonymous session (see the guest_join migration). */
export function isGuest(user: { is_anonymous?: boolean } | null) {
  return user?.is_anonymous === true;
}

/**
 * Use at the top of protected pages and Server Functions. Guest sessions are
 * sent to sign up unless the page is one attendees use (`allowGuest`).
 */
export async function requireUser(next = "/dashboard", { allowGuest = false } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!allowGuest && isGuest(user)) redirect(`/signup?next=${encodeURIComponent(next)}`);
  return user;
}

/** Only allow same-origin relative paths as post-auth redirect targets. */
export function safeNextPath(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
