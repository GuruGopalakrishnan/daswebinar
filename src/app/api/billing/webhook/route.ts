import { NextResponse } from "next/server";
import { razorpayConfig, verifyWebhookSignature, type RazorpaySubscription } from "@/lib/billing/razorpay";
import { findSubscriptionOwner, getSubscriptionRow, isLiveSubscription, saveSubscription } from "@/lib/billing/server";

/**
 * POST /api/billing/webhook — Razorpay → Settings → Webhooks. Subscribe to the
 * subscription.* events and set RAZORPAY_WEBHOOK_SECRET to the same secret.
 *
 * This is what keeps renewals, failed charges and cancellations in sync after
 * the first payment. Razorpay retries on non-2xx, so handling is idempotent.
 */
export async function POST(request: Request) {
  const config = razorpayConfig();
  if (!config?.webhookSecret) {
    return NextResponse.json({ error: { code: "billing_not_configured" } }, { status: 503 });
  }

  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!verifyWebhookSignature(config.webhookSecret, raw, signature)) {
    return NextResponse.json({ error: { code: "invalid_signature" } }, { status: 400 });
  }

  let event: { event?: string; payload?: { subscription?: { entity?: RazorpaySubscription } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: { code: "invalid_json" } }, { status: 400 });
  }

  const sub = event.payload?.subscription?.entity;
  if (!event.event?.startsWith("subscription.") || !sub?.id) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const userId = await findSubscriptionOwner(sub);
    if (!userId) return NextResponse.json({ ok: true, ignored: "unknown_owner" });

    // Events for an older, abandoned subscription mustn't overwrite a live one.
    const row = await getSubscriptionRow(userId);
    if (row?.razorpay_subscription_id && row.razorpay_subscription_id !== sub.id && isLiveSubscription(row)) {
      return NextResponse.json({ ok: true, ignored: "superseded" });
    }

    await saveSubscription(userId, sub);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Razorpay webhook failed", event.event, error);
    // 500 makes Razorpay retry later.
    return NextResponse.json({ error: { code: "internal_error" } }, { status: 500 });
  }
}
