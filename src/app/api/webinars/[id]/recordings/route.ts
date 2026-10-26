import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dbError, handler, notFound, parseBody, parseId, requireApiUser } from "@/lib/api/http";
import { createRecordingSchema } from "@/lib/webinars/schema";
import { RECORDING_COLUMNS, toRecordingDto } from "@/lib/webinars/dto";
import type { RecordingRow } from "@/lib/webinars/types";

type Ctx = RouteContext<"/api/webinars/[id]/recordings">;

/** GET /api/webinars/:id/recordings — host or approved registrant (RLS). */
export const GET = handler<Ctx>(async (_request, ctx) => {
  const id = parseId((await ctx.params).id);
  const supabase = await createClient();
  await requireApiUser(supabase);

  const { data, error } = await supabase
    .from("recordings")
    .select(RECORDING_COLUMNS)
    .eq("webinar_id", id)
    .order("created_at", { ascending: false })
    .overrideTypes<RecordingRow[], { merge: false }>();
  if (error) throw dbError(error);
  return NextResponse.json({ data: data.map(toRecordingDto) });
});

/**
 * POST /api/webinars/:id/recordings — host attaches a recording by HTTPS URL.
 * (Automatic cloud recording arrives with the video provider in Phase 4.)
 */
export const POST = handler<Ctx>(async (request, ctx) => {
  const id = parseId((await ctx.params).id);
  const supabase = await createClient();
  await requireApiUser(supabase);
  const input = await parseBody(request, createRecordingSchema);

  const { data, error } = await supabase
    .from("recordings")
    .insert({
      webinar_id: id,
      title: input.title,
      video_url: input.videoUrl,
      duration_seconds: input.durationSeconds ?? null,
    })
    .select(RECORDING_COLUMNS)
    .overrideTypes<RecordingRow[], { merge: false }>();
  // RLS rejects non-hosts (42501) — present that as not found.
  if (error?.code === "42501") throw notFound();
  if (error) throw dbError(error);
  return NextResponse.json({ data: toRecordingDto(data[0]!) }, { status: 201 });
});
