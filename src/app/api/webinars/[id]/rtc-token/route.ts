import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, handler, notFound, parseId, requireApiUser } from "@/lib/api/http";
import { agoraConfig, issueRtcCredentials } from "@/lib/agora/server";
import { getHostWebinar, getMyRegistration, getPublicWebinar } from "@/lib/webinars/queries";

type Ctx = RouteContext<"/api/webinars/[id]/rtc-token">;

/**
 * POST /api/webinars/:id/rtc-token — Agora credentials for the live video.
 * The host gets a publisher token; approved, signed-in registrants get an
 * audience token. Only while the webinar is live.
 */
export const POST = handler<Ctx>(async (_request, ctx) => {
  const id = parseId((await ctx.params).id);
  const supabase = await createClient();
  const user = await requireApiUser(supabase, { allowGuest: true });

  const config = agoraConfig();
  if (!config) throw new ApiError(503, "video_not_configured", "Video isn't set up for this app yet.");

  const hosted = await getHostWebinar(id);
  if (hosted) {
    if (hosted.status !== "live") throw new ApiError(409, "not_live", "This webinar isn't live.");
    return NextResponse.json({ data: issueRtcCredentials(config, id, "host") });
  }

  const [webinar, registration] = await Promise.all([getPublicWebinar(id), getMyRegistration(id, user.id)]);
  if (!webinar || registration?.status !== "approved") throw notFound();
  if (webinar.status !== "live") throw new ApiError(409, "not_live", "This webinar isn't live.");
  return NextResponse.json({ data: issueRtcCredentials(config, id, "audience") });
});
