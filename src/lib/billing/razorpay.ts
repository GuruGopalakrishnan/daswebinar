import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Minimal Razorpay REST client (Subscriptions API). Uses fetch so there's no
 * SDK dependency. Keys are read at request time.
 *
 * Setup: Razorpay Dashboard → Subscriptions → Plans → create a monthly ₹499 plan
 * and put its id in RAZORPAY_PLAN_ID.
 */

const API = "https://api.razorpay.com/v1";

export function razorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const planId = process.env.RAZORPAY_PLAN_ID;
  if (!keyId || !keySecret || !planId) return null;
  return { keyId, keySecret, planId, webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? null };
}

export type RazorpayConfig = NonNullable<ReturnType<typeof razorpayConfig>>;

export type RazorpaySubscription = {
  id: string;
  plan_id: string;
  customer_id: string | null;
  status: string;
  /** Unix seconds. */
  current_end: number | null;
  charge_at: number | null;
  ended_at: number | null;
  notes: Record<string, string> | [] | null;
  short_url?: string;
};

async function call<T>(config: RazorpayConfig, method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const description = json?.error?.description ?? `HTTP ${res.status}`;
    throw new Error(`Razorpay ${method} ${path} failed: ${description}`);
  }
  return json as T;
}

/** 120 monthly cycles = billed until cancelled, in practice. */
export function createSubscription(config: RazorpayConfig, userId: string, email: string | undefined) {
  return call<RazorpaySubscription>(config, "POST", "/subscriptions", {
    plan_id: config.planId,
    total_count: 120,
    customer_notify: 1,
    notes: { user_id: userId, ...(email ? { email } : {}) },
  });
}

export function fetchSubscription(config: RazorpayConfig, id: string) {
  return call<RazorpaySubscription>(config, "GET", `/subscriptions/${encodeURIComponent(id)}`);
}

export function cancelSubscription(config: RazorpayConfig, id: string, atCycleEnd: boolean) {
  return call<RazorpaySubscription>(config, "POST", `/subscriptions/${encodeURIComponent(id)}/cancel`, {
    cancel_at_cycle_end: atCycleEnd ? 1 : 0,
  });
}

function safeEqualHex(expected: string, actual: string) {
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(actual, "hex");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/** Checkout success handler: signature = HMAC_SHA256(payment_id + "|" + subscription_id, key_secret). */
export function verifyCheckoutSignature(config: RazorpayConfig, paymentId: string, subscriptionId: string, signature: string) {
  const expected = createHmac("sha256", config.keySecret).update(`${paymentId}|${subscriptionId}`).digest("hex");
  return /^[0-9a-f]+$/i.test(signature) && safeEqualHex(expected, signature);
}

/** Webhooks: X-Razorpay-Signature = HMAC_SHA256(raw body, webhook secret). */
export function verifyWebhookSignature(secret: string, rawBody: string, signature: string) {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return /^[0-9a-f]+$/i.test(signature) && safeEqualHex(expected, signature);
}

export function toIso(unixSeconds: number | null | undefined) {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}
