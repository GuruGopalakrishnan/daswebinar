import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dbError, handler, parseId, requireApiUser } from "@/lib/api/http";

type Ctx = RouteContext<"/api/webinars/[id]/start">;

/** POST /api/webinars/:id/start — host only; draft/scheduled → live. Idempotent. */
export const POST = handler<Ctx>(async (_request, ctx) => {
  const id = parseId((await ctx.params).id);
  const supabase = await createClient();
  await requireApiUser(supabase);

  const { data, error } = await supabase.rpc("start_webinar", { p_webinar_id: id });
  if (error) throw dbError(error);
  return NextResponse.json({ data: { status: data } });
});
