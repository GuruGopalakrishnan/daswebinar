import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, handler, parseBody, requireApiUser } from "@/lib/api/http";
import { fetchSubscription, razorpayConfig, verifyCheckoutSignature } from "@/lib/billing/razorpay";
import { getMyPlan, saveSubscription } from "@/lib/billing/server";

const verifySchema = z
  .object({
    paymentId: z.string().min(1).max(64),
    subscriptionId: z.string().min(1).max(64),
    signature: z.string().min(1).max(256),
  })
  .strict();

/**
 * POST /api/billing/verify — called by Checkout's success handler. Checks the
 * signature, then reads the subscription back from Razorpay (never trusting the
 * browser for status or period) and upgrades the account.
 */
export const POST = handler(async (request) => {
  const supabase = await createClient();
  const user = await requireApiUser(supabase);
  const { paymentId, subscriptionId, signature } = await parseBody(request, verifySchema);

  const config = razorpayConfig();
  if (!config) throw new ApiError(503, "billing_not_configured", "Payments aren't set up yet.");
  if (!verifyCheckoutSignature(config, paymentId, subscriptionId, signature)) {
    throw new ApiError(400, "invalid_signature", "We couldn't verify this payment. If you were charged, contact support.");
  }

  const sub = await fetchSubscription(config, subscriptionId);
  const owner = sub.notes && !Array.isArray(sub.notes) ? sub.notes.user_id : undefined;
  if (owner !== user.id) throw new ApiError(403, "forbidden", "This subscription belongs to another account.");

  await saveSubscription(user.id, sub);
  return NextResponse.json({ data: await getMyPlan() });
});
