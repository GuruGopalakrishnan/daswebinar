import type { Metadata } from "next";
import { Pricing } from "@/components/marketing/pricing";
import { Faq, Section, SectionHead } from "@/components/marketing/sections";
import { BRAND } from "@/lib/brand";
import { PRO_PRICE_INR, formatInr } from "@/lib/billing/plans";
import { LANDING_FAQ } from "../faq";

export const metadata: Metadata = {
  title: "Pricing",
  description: `${BRAND.name} is free for your first webinar. Pro is ${formatInr(PRO_PRICE_INR)}/month for unlimited webinars and attendees.`,
};

/** Static page: no session lookup, so it stays fast and cacheable. */
export default function PricingPage() {
  return (
    <>
      <Section>
        <Pricing headingAs="h1" />
      </Section>
      <Section alt>
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-2 lg:gap-14">
          <SectionHead className="mb-0" overline="FAQ" title="Questions about plans" lead="Both plans include every feature. Pro removes the limits." />
          <Faq items={LANDING_FAQ} />
        </div>
      </Section>
    </>
  );
}
