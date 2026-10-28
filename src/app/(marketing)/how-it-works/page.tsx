import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHead } from "@/components/marketing/sections";
import { JourneyScene } from "@/components/motion-graphics/journey";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "How it works",
  description: "From sign-up to your first live webinar: create, share your registration page, go live, engage and follow up.",
};

// Each step describes what the product does today.
const STEPS = [
  {
    title: "Create an account",
    text: "Sign up with your name and email, then open the confirmation link we email you. Answer a quick question so we can set up your dashboard.",
  },
  {
    title: "Create a webinar",
    text: "Use the five-step wizard: details, schedule, room settings, your registration questions, then review and publish.",
  },
  {
    title: "Share your registration page",
    text: "Every webinar gets its own registration page. Registrants get a confirmation email with their personal join link and a calendar invite, then reminders 24 hours and 1 hour before.",
  },
  {
    title: "Check your setup, then go live",
    text: "Test your camera, mic and speakers on the pre-join screen. When you're ready, press Go live and everyone who registered gets a “we're live” email.",
  },
  {
    title: "Engage your audience",
    text: "Answer questions, run a poll on stage, spotlight a question and see raised hands. Slow mode and approvals keep a big room calm.",
  },
  {
    title: "Follow up",
    text: "Save the recording from your computer, add the replay link to your webinar, and registrants can watch it on your replay page.",
  },
];

export default function HowItWorksPage() {
  return (
    <Section>
      <SectionHead as="h1" overline="How it works" title="What happens from sign-up to your first webinar" />
      <div className="mb-10">
        <JourneyScene />
      </div>
      <ol className="flex flex-col gap-8">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex items-start gap-5 rounded-xl border bg-card p-6 shadow-card max-md:p-4">
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {i + 1}
            </span>
            <div className="grid min-w-0 flex-1 gap-2">
              <h2 className="t-h3">{s.title}</h2>
              <p className="text-pretty text-muted-foreground">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg" cta>
          <Link href="/signup">Start free</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/pricing">See pricing</Link>
        </Button>
      </div>
    </Section>
  );
}
