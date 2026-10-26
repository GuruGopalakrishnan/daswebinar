import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dbError, handler, parseBody, parseId } from "@/lib/api/http";
import { registerSchema } from "@/lib/webinars/schema";
import type { RegistrationStatus } from "@/lib/webinars/types";

type Ctx = RouteContext<"/api/webinars/[id]/register">;

/**
 * POST /api/webinars/:id/register — open to guests and signed-in users.
 * Signed-in users are registered under their account email regardless of
 * the email sent. Idempotent per (webinar, email).
 */
export const POST = handler<Ctx>(async (request, ctx) => {
  const id = parseId((await ctx.params).id);
  const { email, fullName, answers } = await parseBody(request, registerSchema);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("register_for_webinar", {
    p_webinar_id: id,
    p_email: email,
    p_full_name: fullName,
    p_answers: answers,
  });
  if (error) throw dbError(error);

  const [row] = data as { registration_id: string; registration_status: RegistrationStatus }[];
  return NextResponse.json(
    { data: { registrationId: row.registration_id, status: row.registration_status } },
    { status: 200 },
  );
});
