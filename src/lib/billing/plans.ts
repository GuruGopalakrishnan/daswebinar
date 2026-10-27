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
    features: [
      "1 webinar",
      `Up to ${FREE_ATTENDEE_LIMIT} attendees`,
      "HD video, screen sharing and audio",
      "Live chat, Q&A, polls and reactions",
      "Registration page with custom questions",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: PRO_PRICE_INR,
    tagline: "For coaches and creators who host every week.",
    features: [
      "Unlimited webinars",
      "Unlimited attendees",
      "Record sessions to your computer",
      "Spotlight questions on stage",
      "Approval workflows and CSV export",
      "Priority support",
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
