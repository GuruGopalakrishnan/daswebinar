"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ONBOARDING_GOALS, ONBOARDING_WORK } from "./options";

const answersSchema = z.object({
  work: z.enum(ONBOARDING_WORK.map((o) => o.value) as [string, ...string[]]),
  goal: z.enum(ONBOARDING_GOALS.map((o) => o.value) as [string, ...string[]]),
});

/**
 * Saves the two onboarding answers on the signed-in account's own metadata (auth.users.raw_user_meta_data),
 * next to full_name. No table or schema change; guests can't reach this (requireUser rejects them).
 */
export async function saveOnboarding(input: { work: string; goal: string }): Promise<{ ok: boolean }> {
  await requireUser("/onboarding");
  const parsed = answersSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { onboarding_work: parsed.data.work, onboarding_goal: parsed.data.goal } });
  return { ok: !error };
}
