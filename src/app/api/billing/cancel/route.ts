import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, handler, requireApiUser } from "@/lib/api/http";
import { cancelSubscription, razorpayConfig } from "@/lib/billing/razorpay";
import { getMyPlan, getSubscriptionRow, isLiveSubscription, saveSubscription } from "@/lib/billing/server";

/** POST /api/billing/cancel — stops renewal; Pro stays on until the paid period ends. */
export const POST = handler(async () => {
  const supabase = await createClient();
  const user = await requireApiUser(supabase);

  const config = razorpayConfig();
  if (!config) throw new ApiError(503, "billing_not_configured", "Payments aren't set up yet.");

  const row = await getSubscriptionRow(user.id);
  if (!row?.razorpay_subscription_id || !isLiveSubscription(row)) {
    throw new ApiError(409, "no_subscription", "You don't have an active subscription.");
  }

  const sub = await cancelSubscription(config, row.razorpay_subscription_id, true);
  await saveSubscription(user.id, sub, { cancelAtPeriodEnd: true });
  return NextResponse.json({ data: await getMyPlan() });
});
