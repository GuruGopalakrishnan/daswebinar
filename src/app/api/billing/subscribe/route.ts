import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, handler, requireApiUser } from "@/lib/api/http";
import { createSubscription, razorpayConfig } from "@/lib/billing/razorpay";
import { getSubscriptionRow, isLiveSubscription, saveSubscription } from "@/lib/billing/server";

/**
 * POST /api/billing/subscribe — creates a Razorpay subscription for the Pro
 * plan and returns what Checkout needs. Access is granted only after the
 * payment is verified (/api/billing/verify) or the webhook confirms it.
 */
export const POST = handler(async () => {
  const supabase = await createClient();
  const user = await requireApiUser(supabase);

  const config = razorpayConfig();
  if (!config) throw new ApiError(503, "billing_not_configured", "Payments aren't set up yet. Please try again later.");

  const existing = await getSubscriptionRow(user.id);
  if (isLiveSubscription(existing)) {
    throw new ApiError(409, "already_subscribed", "You're already on Pro.");
  }

  const sub = await createSubscription(config, user.id, user.email);
  await saveSubscription(user.id, sub, { cancelAtPeriodEnd: false });

  return NextResponse.json({
    data: {
      keyId: config.keyId,
      subscriptionId: sub.id,
      name: (user.user_metadata?.full_name as string | undefined) ?? "",
      email: user.email ?? "",
    },
  });
});
