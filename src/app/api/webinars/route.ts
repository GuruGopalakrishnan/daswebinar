import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dbError, handler, parseBody, parseQuery, requireApiUser } from "@/lib/api/http";
import { createWebinarSchema, listWebinarsQuerySchema } from "@/lib/webinars/schema";
import { toWebinarColumns, toWebinarDto, WEBINAR_COLUMNS } from "@/lib/webinars/dto";
import type { WebinarRow } from "@/lib/webinars/types";

/** GET /api/webinars — the signed-in host's webinars, newest start first. */
export const GET = handler(async (request) => {
  const supabase = await createClient();
  const user = await requireApiUser(supabase);
  const { status, page, limit } = parseQuery(request, listWebinarsQuerySchema);

  const from = (page - 1) * limit;
  let query = supabase
    .from("webinars")
    .select(WEBINAR_COLUMNS, { count: "exact" })
    .eq("host_id", user.id)
    .order("starts_at", { ascending: false })
    .range(from, from + limit - 1);
  if (status) query = query.eq("status", status);

  const { data, error, count } = await query.overrideTypes<WebinarRow[], { merge: false }>();
  if (error) throw dbError(error);

  return NextResponse.json({
    data: data.map(toWebinarDto),
    pagination: { page, limit, total: count ?? 0 },
  });
});

/** POST /api/webinars — create a webinar owned by the signed-in user. */
export const POST = handler(async (request) => {
  const supabase = await createClient();
  const user = await requireApiUser(supabase);
  const input = await parseBody(request, createWebinarSchema);

  const { data, error } = await supabase
    .from("webinars")
    .insert({ ...toWebinarColumns(input), host_id: user.id })
    .select(WEBINAR_COLUMNS)
    .single()
    .overrideTypes<WebinarRow, { merge: false }>();
  if (error) throw dbError(error);

  return NextResponse.json(
    { data: toWebinarDto(data) },
    { status: 201, headers: { Location: `/api/webinars/${data.id}` } },
  );
});
