import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  dbError,
  handler,
  notFound,
  parseId,
  parseQuery,
  requireApiUser,
} from "@/lib/api/http";
import { listRegistrationsQuerySchema } from "@/lib/webinars/schema";
import { REGISTRATION_COLUMNS, toRegistrationDto } from "@/lib/webinars/dto";
import type { RegistrationRow } from "@/lib/webinars/types";

type Ctx = RouteContext<"/api/webinars/[id]/registrations">;

/** GET /api/webinars/:id/registrations — host-only attendee list. */
export const GET = handler<Ctx>(async (request, ctx) => {
  const id = parseId((await ctx.params).id);
  const supabase = await createClient();
  const user = await requireApiUser(supabase);
  const { status, page, limit } = parseQuery(request, listRegistrationsQuerySchema);

  // Registrants can read their own rows via RLS, so check host ownership
  // explicitly; otherwise a registrant would see a one-row "attendee list".
  const { data: webinar, error: webinarError } = await supabase
    .from("webinars")
    .select("id")
    .eq("id", id)
    .eq("host_id", user.id)
    .maybeSingle();
  if (webinarError) throw dbError(webinarError);
  if (!webinar) throw notFound();

  const from = (page - 1) * limit;
  let query = supabase
    .from("registrations")
    .select(REGISTRATION_COLUMNS, { count: "exact" })
    .eq("webinar_id", id)
    .order("created_at", { ascending: true })
    .range(from, from + limit - 1);
  if (status) query = query.eq("status", status);

  const { data, error, count } = await query.overrideTypes<RegistrationRow[], { merge: false }>();
  if (error) throw dbError(error);

  return NextResponse.json({
    data: data.map(toRegistrationDto),
    pagination: { page, limit, total: count ?? 0 },
  });
});
