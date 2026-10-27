"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/webinars/queries";

/**
 * Claims the registration behind a personal join link and enters the room.
 * Signed-out visitors get a guest (anonymous) session first; claim_registration
 * fills in their display name from the registration.
 */
export async function joinWithLink(token: string) {
  if (!isUuid(token)) redirect("/");
  const supabase = await createClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) redirect(`/join/${token}?error=guest_disabled`);
  }

  const { data: webinarId, error } = await supabase.rpc("claim_registration", { p_token: token });
  if (error) {
    redirect(`/join/${token}?error=${error.message === "join_link_claimed" ? "claimed" : "invalid"}`);
  }
  redirect(`/room/${webinarId as string}`);
}
