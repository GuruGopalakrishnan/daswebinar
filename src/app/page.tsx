import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  ClipboardList,
  Hand,
  MessageSquare,
  MessagesSquare,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { HeroPreview } from "@/components/marketing/hero-preview";
import { Pricing } from "@/components/marketing/pricing";

const FEATURES = [
  { icon: MessageSquare, title: "Real-time chat", body: "Fast, threaded-feeling chat with slow mode and host controls when things get busy." },
  { icon: MessagesSquare, title: "Q&A that surfaces the best questions", body: "Attendees upvote; you answer what matters most. No more scrolling for questions." },
  { icon: BarChart3, title: "Live polls", body: "Launch a poll in two clicks and watch results animate in as your audience votes." },
  { icon: Hand, title: "Raise hand", body: "A clean queue of raised hands so you can bring the right voices into the conversation." },
  { icon: ClipboardList, title: "Registration that qualifies", body: "Custom fields, capacity limits and approval workflows on a page that converts." },
  { icon: PlayCircle, title: "Recordings", body: "Share replays with registrants after the event with a fast, keyboard-friendly player." },
];

const STEPS = [
  { icon: CalendarClock, title: "Schedule", body: "Set the time, capacity and the questions you want answered at signup." },
  { icon: Users, title: "Invite", body: "Share a polished registration page. Approve attendees or let them straight in." },
  { icon: Sparkles, title: "Go live", body: "Present, chat, poll and take questions — all in one room built for interaction." },
];

const FAQ = [
  ["Do attendees need an account?", "Anyone can register with just a name and email. Joining the live room interactively requires a free account so chat and Q&A stay spam-free."],
  ["Can I require approval before people join?", "Yes. Turn on approval and every registration lands in a review queue you can approve or reject."],
  ["Can I ask custom questions at signup?", "Add up to 10 fields — short text, long text, dropdowns and checkboxes — and mark any of them required."],
  ["Does it work on mobile?", "The registration page, room and replays are fully responsive, with a touch-friendly chat and controls."],
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="bg-dots mask-radial absolute inset-0 -z-10" />
          <div aria-hidden className="absolute top-[-20%] left-1/2 -z-10 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
          <div className="mx-auto max-w-6xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28">
            <Reveal className="mx-auto max-w-3xl text-center">
              <Link
                href="#features"
                className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
              >
                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-medium text-primary">New</span>
                Live polls with animated results
                <ArrowRight className="size-3" />
              </Link>
              <h1 className="text-gradient text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
                Webinars your audience actually <span className="text-brand-gradient">participates</span> in
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
                Schedule in minutes, collect the right signups, and run a live room with chat, Q&amp;A, polls and
                reactions — on any device.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="glow-primary">
                  <Link href="/signup">
                    Host your first webinar <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="#how-it-works">See how it works</Link>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Free plan · No credit card required</p>
            </Reveal>

            <Reveal delay={0.15} y={32} className="mx-auto mt-16 max-w-5xl">
              <HeroPreview />
            </Reveal>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 border-t">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <Reveal className="max-w-2xl">
              <p className="text-sm font-medium text-primary">Features</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Everything the live moment needs</h2>
              <p className="mt-4 text-muted-foreground">
                Interaction tools that are fast, focused and out of your way until you need them.
              </p>
            </Reveal>
            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={i * 0.05} className="group bg-card p-6 transition-colors hover:bg-accent/40">
                  <span className="inline-flex size-9 items-center justify-center rounded-lg border bg-background text-primary transition-transform group-hover:scale-105">
                    <f.icon className="size-4.5" />
                  </span>
                  <h3 className="mt-4 font-medium">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 border-t bg-card/30">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-medium text-primary">How it works</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">From idea to live in three steps</h2>
            </Reveal>
            <div role="list" className="mt-14 grid gap-6 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 0.08} role="listitem">
                  <div className="relative h-full rounded-2xl border bg-card p-6">
                    <span className="absolute top-6 right-6 font-mono text-xs text-muted-foreground">0{i + 1}</span>
                    <s.icon className="size-5 text-primary" />
                    <h3 className="mt-4 font-medium">{s.title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 border-t">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <Reveal className="mx-auto mb-10 max-w-2xl text-center">
              <p className="text-sm font-medium text-primary">Pricing</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Simple plans that scale with you</h2>
              <p className="mt-4 text-muted-foreground">Start free. Upgrade when your audience grows.</p>
            </Reveal>
            <Pricing />
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 border-t bg-card/30">
          <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
            <Reveal className="text-center">
              <h2 className="text-3xl font-semibold tracking-tight">Questions, answered</h2>
            </Reveal>
            <div className="mt-10 divide-y rounded-2xl border bg-card">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {q}
                    <span className="text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <Reveal className="relative overflow-hidden rounded-3xl border bg-card px-6 py-16 text-center sm:px-16">
              <div aria-hidden className="absolute inset-0 -z-0 bg-[radial-gradient(ellipse_at_top,oklch(0.66_0.19_280/0.25),transparent_60%)]" />
              <div className="relative">
                <ShieldCheck className="mx-auto size-6 text-primary" />
                <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Your next webinar starts here</h2>
                <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
                  Create a free account and have a registration page live in under five minutes.
                </p>
                <Button asChild size="lg" className="mt-8">
                  <Link href="/signup">
                    Get started free <ArrowRight />
                  </Link>
                </Button>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
