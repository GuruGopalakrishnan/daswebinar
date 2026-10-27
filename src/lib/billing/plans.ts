// Plan catalogue shown on the landing page, billing page and upgrade prompts.
// The limits themselves are enforced in the database
// (supabase/migrations/20261027000000_plans_billing.sql); keep the numbers in sync.

export type PlanId = "free" | "pro";

export const FREE_WEBINAR_LIMIT = 1;
export const FREE_ATTENDEE_LIMIT = 100;

/** Monthly price in rupees. The charged amount comes from the Razorpay plan (RAZORPAY_PLAN_ID). */
export const PRO_PRICE_INR = 499;

export function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    tagline: "Run your first webinar and see the difference.",
    // Every feature is on Free; the plans differ only in the limits below.
    // Keep these lists honest: never list a feature under Pro that Free also has.
    features: [
      "1 webinar",
      `Up to ${FREE_ATTENDEE_LIMIT} attendees`,
      "HD video, screen sharing and audio",
      "Live chat, Q&A, polls and reactions",
      "Registration page, reminders and join links",
      "Record to your computer",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: PRO_PRICE_INR,
    tagline: "For coaches and creators who host every week.",
    features: [
      "Everything in Free",
      "Unlimited webinars",
      "Unlimited attendees per webinar",
      "Run as many live sessions as you like",
    ],
  },
} as const satisfies Record<PlanId, { id: PlanId; name: string; price: number; tagline: string; features: readonly string[] }>;

/** get_my_plan() */
export type MyPlan = {
  plan: PlanId;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  webinarCount: number;
  webinarsRun: number;
  attendeeCap: number | null;
};
