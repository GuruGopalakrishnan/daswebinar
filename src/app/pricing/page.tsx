import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Pricing } from "@/components/marketing/pricing";
import { BRAND } from "@/lib/brand";
import { FREE_ATTENDEE_LIMIT, PRO_PRICE_INR, formatInr } from "@/lib/billing/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description: `${BRAND.name} is free for your first webinar. Pro is ${formatInr(PRO_PRICE_INR)}/month for unlimited webinars and attendees.`,
};

const FAQ = [
  {
    q: "What's the difference between Free and Pro?",
    a: `Only the limits. Free includes every feature for one webinar of up to ${FREE_ATTENDEE_LIMIT} attendees. Pro removes both limits.`,
  },
  {
    q: "What happens when my free webinar is full?",
    a: `New registrations stop at ${FREE_ATTENDEE_LIMIT} and visitors see that the webinar is full. Upgrade and registration opens again straight away.`,
  },
  {
    q: "How do I pay?",
    a: "Through Razorpay: UPI, debit and credit cards, or net banking. Pro renews monthly.",
  },
  {
    q: "Can I cancel?",
    a: "Any time, from Plan & billing. Pro stays on until the end of the month you've paid for, then your account moves to Free. Nothing is deleted.",
  },
];

/** Static page: no session lookup, so it stays fast and cacheable. */
export default function PricingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 pt-16 pb-20 text-center sm:px-6 sm:pt-24">
          <p className="rise text-sm font-medium text-primary">Pricing</p>
          <h1 className="rise rise-1 mt-3 font-display text-5xl leading-[1.05] tracking-tight text-balance sm:text-7xl">
            Start free. Grow when you&apos;re ready.
          </h1>
          <p className="rise rise-2 mx-auto mt-5 max-w-xl text-pretty text-muted-foreground sm:text-lg">
            Every feature is included on both plans. Pro simply removes the limits, for hosts who run webinars every week.
          </p>
          <div className="rise rise-3 mt-14 text-left">
            <Pricing />
          </div>
        </section>

        <section aria-labelledby="pricing-faq" className="border-t">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 id="pricing-faq" className="font-display text-4xl tracking-tight">
              Questions about plans
            </h2>
            <dl className="mt-8 divide-y border-y">
              {FAQ.map((item) => (
                <div key={item.q} className="py-5">
                  <dt className="font-medium">{item.q}</dt>
                  <dd className="mt-1.5 text-pretty text-muted-foreground">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
