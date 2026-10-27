import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dbError, handler, parseId, requireApiUser } from "@/lib/api/http";
import { notifyWebinarLive } from "@/lib/email/notify";
import { getSiteUrl } from "@/lib/site-url";

type Ctx = RouteContext<"/api/webinars/[id]/start">;

/** The "we're live" emails run after the response; large lists take a few batches. */
export const maxDuration = 60;

/** POST /api/webinars/:id/start — host only; draft/scheduled → live. Idempotent. */
export const POST = handler<Ctx>(async (_request, ctx) => {
  const id = parseId((await ctx.params).id);
  const supabase = await createClient();
  await requireApiUser(supabase);

  const { data, error } = await supabase.rpc("start_webinar", { p_webinar_id: id });
  if (error) throw dbError(error);

  // Safe to repeat: email_log sends each person the live email once.
  if (data === "live") {
    const siteUrl = await getSiteUrl();
    after(() => notifyWebinarLive(id, siteUrl));
  }
  return NextResponse.json({ data: { status: data } });
});
