import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, dbError, handler, notFound, parseId, requireApiUser } from "@/lib/api/http";
import { agoraConfig, issueRtcCredentials } from "@/lib/agora/server";
import type { WebinarStatus } from "@/lib/webinars/types";

type Ctx = RouteContext<"/api/webinars/[id]/rtc-token">;

/** get_room_access() in supabase/migrations/20261030000000_panelists_practice.sql */
type RoomAccess = {
  role: "host" | "panelist" | "attendee";
  rtcUid: number | null;
  status: WebinarStatus;
  practice: boolean;
};

/**
 * POST /api/webinars/:id/rtc-token — Agora credentials for the live video.
 *
 * Media permission is decided here, from the database:
 * - host: publisher token while live or in practice
 * - panelist: publisher token bound to their stage uid while live or in practice
 * - attendee: audience token, only once the webinar is live
 */
export const POST = handler<Ctx>(async (_request, ctx) => {
  const id = parseId((await ctx.params).id);
  const supabase = await createClient();
  await requireApiUser(supabase, { allowGuest: true });

  const config = agoraConfig();
  if (!config) throw new ApiError(503, "video_not_configured", "Video isn't set up for this app yet.");

  const { data, error } = await supabase.rpc("get_room_access", { p_webinar_id: id });
  if (error) throw dbError(error);
  const access = data as RoomAccess | null;
  if (!access) throw notFound();

  const live = access.status === "live";
  const onStage = access.role === "host" || access.role === "panelist";
  if (!live && !(onStage && access.practice)) throw new ApiError(409, "not_live", "This webinar isn't live.");

  if (access.role === "host") return NextResponse.json({ data: issueRtcCredentials(config, id, "host") });
  if (access.role === "panelist" && access.rtcUid) {
    return NextResponse.json({ data: issueRtcCredentials(config, id, "panelist", access.rtcUid) });
  }
  return NextResponse.json({ data: issueRtcCredentials(config, id, "audience") });
});
