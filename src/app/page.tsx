import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeIndianRupee,
  CircleCheck,
  ClipboardCheck,
  Gauge,
  HardDriveDownload,
  MonitorPlay,
  ShieldCheck,
  Sparkles,
  Users,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { HeroPreview } from "@/components/marketing/hero-preview";
import { Pricing } from "@/components/marketing/pricing";
import { BRAND } from "@/lib/brand";
import { FREE_ATTENDEE_LIMIT, PRO_PRICE_INR, formatInr } from "@/lib/billing/plans";

// Copy leads with what the host gets, not with the feature name.
const BENEFITS = [
  {
    icon: ShieldCheck,
    title: "Walk on stage with zero tech panic",
    body: "A 20-second check of your camera, mic and speakers before you go live. If something's off, you'll know before your audience does.",
  },
  {
    icon: MonitorPlay,
    title: "Slides that stay sharp and never stutter",
    body: "Screen sharing is tuned for text-heavy slides, and your face stays on screen beside them, so the room feels personal.",
  },
  {
    icon: Sparkles,
    title: "An audience that leans in, not tunes out",
    body: "Pop a poll onto everyone's screen, spotlight the best question, and watch reactions roll in. Engaged rooms buy.",
  },
  {
    icon: ClipboardCheck,
    title: "Know who's coming before they arrive",
    body: "A clean registration page with your own questions, so you walk in knowing your audience and leave with warm leads.",
  },
  {
    icon: Gauge,
    title: "Stay in control when the room gets big",
    body: "Slow mode, approvals and one-click removal keep a hundred-person room calm, so you can focus on teaching.",
  },
  {
    icon: HardDriveDownload,
    title: "Turn one live session into evergreen content",
    body: "Record straight to your computer and reuse the replay for courses, ads and people who missed it.",
  },
];

const STEPS = [
  { title: "Create your webinar", body: "Pick a time and add your signup questions. It takes under five minutes." },
  { title: "Share your link", body: "Post it on WhatsApp, Instagram or email. Attendees register in seconds." },
  { title: "Go live and convert", body: "Present, poll and answer questions in a room that looks as premium as your offer." },
];

const FAQ = [
  [
    "Do my attendees need to download anything?",
    "No. Everything runs in the browser on laptops and phones. Attendees register with their name and email and join with one click.",
  ],
  [
    "What do I get on the free plan?",
    `One complete webinar with up to ${FREE_ATTENDEE_LIMIT} attendees, including HD video, screen sharing, chat, Q&A, polls and reactions. No card needed.`,
  ],
  [
    "How does payment work?",
    `Pro is ${formatInr(PRO_PRICE_INR)} per month, charged in rupees through Razorpay. Pay with UPI, card or net banking. Cancel any time and keep Pro until the end of the month you've paid for.`,
  ],
  [
    "What happens if my internet is slow?",
    "Video quality adapts automatically for attendees on weaker connections, and the room reconnects on its own if someone's network drops for a moment.",
  ],
  [
    "Where do my recordings go?",
    "Recordings save to your own computer, so you own the file outright. You can then upload it anywhere and share the replay link with registrants.",
  ],
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="grain absolute inset-0 -z-10 opacity-60" />
          <div className="mx-auto max-w-6xl px-4 pt-16 pb-24 sm:px-6 sm:pt-24">
            <div className="mx-auto max-w-3xl text-center">
              <p className="rise inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-primary" /> For coaches, educators and creators
              </p>
              <h1 className="rise rise-1 mt-6 font-display text-5xl leading-[1.02] tracking-tight text-balance sm:text-7xl">
                Hold the room. <em className="text-primary">Every single time.</em>
              </h1>
              <p className="rise rise-2 mx-auto mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
                Run webinars that look polished, sound crystal clear and keep 100+ people engaged right up to your offer.
                No tech headaches.
              </p>
              <div className="rise rise-3 mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-full px-7 text-base">
                  <Link href="/signup">
                    Host your first webinar free <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-full px-7 text-base">
                  <Link href="#pricing">See pricing</Link>
                </Button>
              </div>
              <p className="rise rise-3 mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><CircleCheck className="size-3.5 text-primary" /> Free plan, no card</span>
                <span className="inline-flex items-center gap-1"><CircleCheck className="size-3.5 text-primary" /> Live in 5 minutes</span>
                <span className="inline-flex items-center gap-1"><CircleCheck className="size-3.5 text-primary" /> Pay in ₹ with UPI</span>
              </p>
            </div>

            <div className="rise rise-3 mt-16">
              <HeroPreview />
            </div>
          </div>
        </section>

        {/* Outcomes strip */}
        <section className="border-y bg-card">
          <div className="mx-auto grid max-w-6xl divide-y px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6">
            {[
              { icon: Users, title: "Built for big rooms", body: "Smooth for 100+ live attendees" },
              { icon: Wifi, title: "Kind to slow networks", body: "Quality adapts per attendee" },
              { icon: BadgeIndianRupee, title: "Priced for India", body: `Pro at ${formatInr(PRO_PRICE_INR)} a month` },
            ].map((item) => (
              <div key={item.title} className="flex items-center gap-4 py-6 sm:px-6">
                <item.icon className="size-5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Benefits */}
        <section id="benefits" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-primary">Why hosts switch to {BRAND.name}</p>
              <h2 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
                Your expertise deserves a stage that matches it
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Every glitch costs you trust. Every quiet room costs you sales. We fixed both.
              </p>
            </div>
            <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {BENEFITS.map((b) => (
                <div key={b.title}>
                  <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <b.icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-medium">{b.title}</h3>
                  <p className="mt-2 text-muted-foreground">{b.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 bg-foreground text-background">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-28">
            <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
              <div>
                <p className="text-sm font-medium text-highlight">How it works</p>
                <h2 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">From idea to live in an afternoon</h2>
                <p className="mt-4 text-background/70">
                  No studio, no software installs, no tech assistant. If you can share a link, you can run a webinar that
                  looks like a production.
                </p>
              </div>
              <ol className="grid gap-px overflow-hidden rounded-3xl bg-background/10">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="flex gap-5 bg-foreground p-6 sm:p-7">
                    <span className="font-display text-4xl text-highlight">{i + 1}</span>
                    <div>
                      <h3 className="text-lg font-medium">{s.title}</h3>
                      <p className="mt-1 text-background/70">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <p className="text-sm font-medium text-primary">Pricing</p>
              <h2 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">Start free. Grow when you&apos;re ready.</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Run your first webinar on us. When you&apos;re hosting regularly, one simple plan covers everything.
              </p>
            </div>
            <Pricing />
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 border-t bg-card">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
            <div>
              <h2 className="font-display text-4xl tracking-tight">Good questions</h2>
              <p className="mt-3 text-muted-foreground">Everything you need to know before your first session.</p>
            </div>
            <div className="divide-y border-y">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium">
                    {q}
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section>
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="relative overflow-hidden rounded-[32px] bg-primary px-6 py-16 text-center text-primary-foreground sm:px-16 sm:py-20">
              <div aria-hidden className="absolute -top-24 left-1/2 h-64 w-[640px] -translate-x-1/2 rounded-full bg-highlight/30 blur-[90px]" />
              <div className="relative">
                <h2 className="font-display text-4xl tracking-tight sm:text-6xl">Your next webinar could be your best one</h2>
                <p className="mx-auto mt-4 max-w-lg text-primary-foreground/80">
                  Set it up today, share the link tonight, and go live looking like you have a production team.
                </p>
                <Button asChild size="lg" className="mt-9 h-12 rounded-full bg-background px-7 text-base text-foreground hover:bg-background/90">
                  <Link href="/signup">
                    Start free <ArrowUpRight />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
