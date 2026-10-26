import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  dbError,
  handler,
  notFound,
  parseBody,
  parseId,
  requireApiUser,
} from "@/lib/api/http";
import { updateRegistrationSchema } from "@/lib/webinars/schema";
import { REGISTRATION_COLUMNS, toRegistrationDto } from "@/lib/webinars/dto";
import type { RegistrationRow } from "@/lib/webinars/types";

type Ctx = RouteContext<"/api/webinars/[id]/registrations/[registrationId]">;

/** PATCH /api/webinars/:id/registrations/:registrationId — host approves/rejects. */
export const PATCH = handler<Ctx>(async (request, ctx) => {
  const params = await ctx.params;
  const webinarId = parseId(params.id);
  const registrationId = parseId(params.registrationId);
  const supabase = await createClient();
  await requireApiUser(supabase);
  const { status } = await parseBody(request, updateRegistrationSchema);

  // RLS update policy limits this to the webinar's host.
  const { data, error } = await supabase
    .from("registrations")
    .update({ status })
    .eq("id", registrationId)
    .eq("webinar_id", webinarId)
    .select(REGISTRATION_COLUMNS)
    .overrideTypes<RegistrationRow[], { merge: false }>();
  if (error) throw dbError(error);
  if (data.length === 0) throw notFound();

  return NextResponse.json({ data: toRegistrationDto(data[0]) });
});
