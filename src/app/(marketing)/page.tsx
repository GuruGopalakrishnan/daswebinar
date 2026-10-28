import { ArrowRight, Clock, Globe, ShieldCheck, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ManagementArt } from "@/components/marketing/product-art";
import { Pricing } from "@/components/marketing/pricing";
import { Faq, FeatureSplit, Section, SectionHead, Wrap } from "@/components/marketing/sections";
import { FeatureDemo } from "@/components/motion-graphics/feature-demos";
import { HeroScene } from "@/components/motion-graphics/hero";
import { JourneyScene } from "@/components/motion-graphics/journey";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { FREE_ATTENDEE_LIMIT } from "@/lib/billing/plans";
import { LANDING_FAQ } from "./faq";

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name}: ${BRAND.tagline}` },
  description: BRAND.description,
};

const TRUST = [
  { icon: Globe, title: "Runs in the browser", text: "Hosts and attendees join from a link. Nothing to install." },
  { icon: Wallet, title: "Prices in ₹", text: "Simple monthly pricing, paid through Razorpay." },
  { icon: ShieldCheck, title: "Your audience, your list", text: "Every registration and answer is in your dashboard." },
  { icon: Clock, title: "Live in an afternoon", text: "Create, share and go live on the same day." },
];

const PRODUCT = [
  { title: "Dashboard", text: "See what is coming up, who registered and what needs your attention.", cover: "c3" },
  { title: "Registration page", text: "A clean page that loads fast on phones and shows your schedule clearly.", cover: "c1" },
  { title: "Host studio", text: "Stage, controls and audience in one calm screen.", cover: "c4" },
];

// Entrance stagger for the hero copy (CSS only; off under reduced motion).
const RISE = "motion-safe:animate-[route-in_520ms_var(--ease-out)_both]";
const delay = (i: number) => ({ animationDelay: `${i * 60}ms` });

/** Fully static landing page: no session lookup, motion is CSS, scenes run only while on screen. */
export default function HomePage() {
  return (
    <>
      <section className="pt-12 pb-14 md:pt-[72px]">
        <Wrap className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="flex min-w-0 flex-col gap-6">
            <span
              style={delay(0)}
              className={`${RISE} inline-flex w-fit items-center gap-2 rounded-full border bg-card py-1 pr-2.5 pl-1 text-[13px] font-medium`}
            >
              <Badge variant="teal" className="h-5">
                New
              </Badge>
              Built for coaches and creators in India
            </span>
            <h1 style={delay(1)} className={`${RISE} t-display`}>
              Host better webinars. Turn more attendees into customers.
            </h1>
            <p style={delay(2)} className={`${RISE} t-lead text-pretty`}>
              Create professional webinars, engage your audience, collect registrations, and grow your business, all from one simple
              platform.
            </p>
            <div style={delay(3)} className={`${RISE} flex flex-wrap gap-2`}>
              <Button asChild size="lg" cta>
                <Link href="/signup">Start free</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/features">Explore the platform</Link>
              </Button>
            </div>
            <p style={delay(4)} className={`${RISE} text-sm text-muted-foreground`}>
              Free plan: one webinar, up to {FREE_ATTENDEE_LIMIT} attendees. No card needed.
            </p>
          </div>
          <div className="min-w-0">
            <HeroScene />
          </div>
        </Wrap>
      </section>

      <section aria-label="Why hosts choose us" className="border-y bg-card py-8">
        <Wrap className="grid grid-cols-[minmax(0,1fr)] gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-3">
              <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="text-[15px] leading-6 font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </Wrap>
      </section>

      <Section>
        <SectionHead overline="How it works" title="From idea to first sale in five steps" />
        <JourneyScene />
        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline">
            <Link href="/how-it-works">
              See each step in detail <ArrowRight />
            </Link>
          </Button>
        </div>
      </Section>

      <FeatureSplit
        overline="Webinar management"
        title="Every webinar in one workspace"
        text="Schedule sessions, approve registrants and copy each attendee's personal join link from a single page per webinar."
        points={["Drafts and scheduled webinars in your time zone", "Manual approval when you want to choose who joins", "Personal join links, so attendees never need an account"]}
        art={<ManagementArt />}
      />
      <FeatureSplit
        flip
        overline="Audience engagement"
        title="Keep the room leaning in"
        text="Chat for energy, Q&A for real questions, polls for decisions. Spotlight the best question on stage."
        points={["Upvoted Q&A, kept apart from chat", "Live polls with results on stage", "Hand raise, so you see who wants to speak", "Reactions that never cover your slides"]}
        art={<FeatureDemo kind="engagement" />}
      />
      <FeatureSplit
        overline="Registration"
        title="A registration page that fills your room"
        text="Every webinar gets a page with your own questions. Registrants get a confirmation email with their join link, then reminders before you start."
        points={["Your questions on the form: short answer, long answer, dropdown, checkbox", "Reminder emails 24 hours and 1 hour before, and a “we're live” email", "Calendar invite attached to the confirmation"]}
        note="Paid tickets through Razorpay are coming soon."
        art={<FeatureDemo kind="registration" />}
      />
      <FeatureSplit
        flip
        soon
        overline="Conversion tools"
        title="Make your offer at the right moment"
        text="Offer cards and featured links you publish on stage with one click, with clicks counted per offer. We're building this now."
        points={["Offer cards with image, price and button", "Pinned links for resources", "Post-webinar redirect to any page", "Impressions and clicks per offer"]}
        art={<FeatureDemo kind="conversion" />}
      />
      <FeatureSplit
        overline="Recordings"
        title="Teach once, share the replay"
        text="Record the session straight to your computer while you present. Recording is saved as you go, so a crash or closed tab loses only a couple of seconds."
        points={["One click to record, and everyone sees the REC badge", "Recover an interrupted recording from your dashboard", "Add the replay link and registrants watch it on your replay page"]}
        note="Automated webinars that replay a recording on a schedule are coming soon."
        art={<FeatureDemo kind="recording" />}
      />

      <Section alt>
        <SectionHead overline="Inside the product" title="Designed for the work hosts actually do" />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-3">
          {PRODUCT.map((p) => (
            <div key={p.title} className="overflow-hidden rounded-xl border bg-card shadow-card">
              <div aria-hidden className={`cover ${p.cover} aspect-video`} />
              <div className="grid gap-2 p-4">
                <h3 className="t-title">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="pricing">
        <Pricing />
      </Section>

      <Section alt>
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-2 lg:gap-14">
          <SectionHead
            className="mb-0"
            overline="FAQ"
            title="Questions hosts ask before their first session"
            lead={
              <>
                Still unsure? Start free and run a test webinar with a friend. It takes about ten minutes.
              </>
            }
          />
          <Faq items={LANDING_FAQ} />
        </div>
      </Section>

      <Section>
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-[18px] bg-[linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary)_82%,var(--teal)))] px-6 py-8 text-primary-foreground md:p-14">
          <div className="flex max-w-[560px] flex-col gap-2">
            <h2 className="t-h1">Your next webinar could be your best one</h2>
            <p className="t-lead text-[color-mix(in_oklch,var(--primary-foreground)_75%,var(--primary))]">
              Start on the Free plan. Upgrade when you need more webinars or a bigger room.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="lg" cta className="bg-primary-foreground text-primary shadow-none hover:bg-primary-foreground/90">
              <Link href="/signup">Start free</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-[color-mix(in_oklch,var(--primary-foreground)_35%,transparent)] bg-transparent text-primary-foreground shadow-none hover:bg-primary-foreground/10"
            >
              <Link href="/how-it-works">See how it works</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
