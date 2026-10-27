import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MyPlan } from "./plans";
import { toIso, type RazorpaySubscription } from "./razorpay";

/** The signed-in user's plan and usage (get_my_plan). */
export async function getMyPlan(): Promise<MyPlan> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_plan");
  if (error) throw error;
  return data as MyPlan;
}

/** States in which the subscription is (or is about to be) paid for. */
const LIVE_STATES = new Set(["authenticated", "active", "pending"]);

export async function getSubscriptionRow(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select("user_id, status, razorpay_subscription_id, current_period_end, cancel_at_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as {
    user_id: string;
    status: string;
    razorpay_subscription_id: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
}

export function isLiveSubscription(row: { status: string; current_period_end: string | null } | null) {
  return Boolean(row && LIVE_STATES.has(row.status) && row.current_period_end && Date.parse(row.current_period_end) > Date.now());
}

/**
 * Writes Razorpay's view of a subscription to our table. Called after checkout
 * verification and from the webhook, so it must be idempotent.
 */
export async function saveSubscription(userId: string, sub: RazorpaySubscription, patch: { cancelAtPeriodEnd?: boolean } = {}) {
  const admin = createAdminClient();
  // A cancelled-immediately or ended subscription stops at ended_at.
  const periodEnd = sub.status === "cancelled" || sub.status === "completed" || sub.status === "expired"
    ? toIso(sub.ended_at) ?? toIso(sub.current_end)
    : toIso(sub.current_end);

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan: "pro",
      status: sub.status,
      razorpay_subscription_id: sub.id,
      razorpay_customer_id: sub.customer_id,
      current_period_end: periodEnd,
      ...(patch.cancelAtPeriodEnd !== undefined ? { cancel_at_period_end: patch.cancelAtPeriodEnd } : {}),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

/** Which user a Razorpay subscription belongs to: our row first, then the notes we set at creation. */
export async function findSubscriptionOwner(sub: RazorpaySubscription): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("subscriptions").select("user_id").eq("razorpay_subscription_id", sub.id).maybeSingle();
  if (data?.user_id) return data.user_id as string;
  const notes = sub.notes && !Array.isArray(sub.notes) ? sub.notes : null;
  return notes?.user_id ?? null;
}
