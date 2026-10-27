import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dbError, handler, parseBody, parseId } from "@/lib/api/http";
import { notifyRegistrationApproved } from "@/lib/email/notify";
import { getSiteUrl } from "@/lib/site-url";
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

  // Repeat registrations are no-ops here: email_log sends the confirmation once.
  if (row.registration_status === "approved") {
    const siteUrl = await getSiteUrl();
    after(() => notifyRegistrationApproved(row.registration_id, siteUrl));
  }

  // RLS only returns the row if the caller (account or guest session) owns it,
  // so a typed-in email never reveals someone else's join link.
  const { data: own } = await supabase
    .from("registrations")
    .select("join_token")
    .eq("id", row.registration_id)
    .maybeSingle<{ join_token: string }>();

  return NextResponse.json(
    {
      data: {
        registrationId: row.registration_id,
        status: row.registration_status,
        joinPath: own ? `/join/${own.join_token}` : null,
      },
    },
    { status: 200 },
  );
});
