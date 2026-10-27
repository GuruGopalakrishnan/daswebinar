import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendScheduledEmails } from "@/lib/email/notify";
import { getSiteUrl } from "@/lib/site-url";

/** Large webinars take a few batches; give the job room. */
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  // Hash both sides so the comparison is constant-time whatever the lengths.
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b);
}

/**
 * GET|POST /api/cron/emails: reminders and the live catch-up. Call it every
 * 5–10 minutes with `Authorization: Bearer <CRON_SECRET>` (Supabase pg_cron,
 * Vercel Cron or any cron service; see the README).
 */
async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: { code: "unauthorized" } }, { status: 401 });
  }
  try {
    const result = await sendScheduledEmails(await getSiteUrl());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Scheduled emails failed", error);
    return NextResponse.json({ error: { code: "internal_error" } }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
