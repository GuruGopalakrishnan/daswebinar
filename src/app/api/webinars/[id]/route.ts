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
import { updateWebinarSchema } from "@/lib/webinars/schema";
import {
  toPublicWebinarDto,
  toWebinarColumns,
  toWebinarDto,
  WEBINAR_COLUMNS,
} from "@/lib/webinars/dto";
import type { PublicWebinarRow, WebinarRow } from "@/lib/webinars/types";

type Ctx = RouteContext<"/api/webinars/[id]">;

/**
 * GET /api/webinars/:id
 * The host gets the full record; anyone else (including signed-out visitors)
 * gets the public view. Drafts are invisible to non-hosts.
 */
export const GET = handler<Ctx>(async (_request, ctx) => {
  const id = parseId((await ctx.params).id);
  const supabase = await createClient();

  // RLS returns the row only to its host.
  const { data: owned, error: ownedError } = await supabase
    .from("webinars")
    .select(WEBINAR_COLUMNS)
    .eq("id", id)
    .overrideTypes<WebinarRow[], { merge: false }>();
  if (ownedError) throw dbError(ownedError);
  if (owned.length > 0) {
    return NextResponse.json({ data: toWebinarDto(owned[0]), view: "host" });
  }

  const { data, error } = await supabase.rpc("get_public_webinar", { p_webinar_id: id });
  if (error) throw dbError(error);
  const [row] = (data ?? []) as PublicWebinarRow[];
  if (!row) throw notFound();

  return NextResponse.json({ data: toPublicWebinarDto(row), view: "public" });
});

/** PATCH /api/webinars/:id — host-only partial update. */
export const PATCH = handler<Ctx>(async (request, ctx) => {
  const id = parseId((await ctx.params).id);
  const supabase = await createClient();
  await requireApiUser(supabase);
  const patch = await parseBody(request, updateWebinarSchema);

  // Zero matched rows means missing or not ours; both are a 404.
  const { data, error } = await supabase
    .from("webinars")
    .update(toWebinarColumns(patch))
    .eq("id", id)
    .select(WEBINAR_COLUMNS)
    .overrideTypes<WebinarRow[], { merge: false }>();
  if (error) throw dbError(error);
  if (data.length === 0) throw notFound();

  return NextResponse.json({ data: toWebinarDto(data[0]) });
});

/** DELETE /api/webinars/:id — host-only; registrations cascade. */
export const DELETE = handler<Ctx>(async (_request, ctx) => {
  const id = parseId((await ctx.params).id);
  const supabase = await createClient();
  await requireApiUser(supabase);

  const { data, error } = await supabase.from("webinars").delete().eq("id", id).select("id");
  if (error) throw dbError(error);
  if (data.length === 0) throw notFound();

  return new NextResponse(null, { status: 204 });
});
