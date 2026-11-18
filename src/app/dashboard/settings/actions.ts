"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ProfileFormState = { ok?: boolean; error?: string; fieldErrors?: { fullName?: string[] } };

const profileSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name.").max(100, "Use 100 characters or fewer."),
});

/**
 * Updates the signed-in host's display name in the two places it already lives: the account's own metadata
 * (full_name, read by the dashboard and the room) and public.profiles.full_name (host name on event pages and
 * in emails), through the existing "profiles: owner can update" RLS policy. No schema change. Guests can't
 * reach this (requireUser rejects them).
 */
export async function updateProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await requireUser("/dashboard/settings/profile");
  const parsed = profileSchema.safeParse({ fullName: formData.get("fullName") });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { error: authError } = await supabase.auth.updateUser({ data: { full_name: parsed.data.fullName } });
  if (authError) return { error: "Couldn't save your name. Try again." };

  const { error: profileError } = await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", user.id);
  if (profileError) return { error: "Your name was saved, but your public host name didn't update. Try saving again." };

  return { ok: true };
}
