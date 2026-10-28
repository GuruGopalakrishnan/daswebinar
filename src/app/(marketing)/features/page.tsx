import { BarChart3, Film, Gift, MessagesSquare, Repeat, Ticket, Users, Video, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StudioPreview } from "@/components/marketing/product-art";
import { ComingSoon, Section, SectionHead } from "@/components/marketing/sections";
import { FEATURE_DEMO_KINDS, FeatureDemo, type FeatureDemoKind } from "@/components/motion-graphics/feature-demos";
import { Button } from "@/components/ui/button";
import { FREE_ATTENDEE_LIMIT } from "@/lib/billing/plans";

export const metadata: Metadata = {
  title: "Features",
  description: "Registration pages, a premium studio, chat, Q&A, polls and recordings. Everything you need to host webinars in India.",
};

const FEATURES: { icon: LucideIcon; title: string; text: string; soon?: boolean }[] = [
  { icon: Video, title: "Studio that looks premium", text: "Present slides or share your screen with your camera beside them, in a layout made for teaching, not meetings." },
  { icon: Users, title: "Registration pages in minutes", text: "A page for every webinar with your own questions and a countdown to the start." },
  { icon: MessagesSquare, title: "Chat, Q&A and polls", text: "Keep questions separate from chatter, run polls on stage and spotlight the best question." },
  { icon: Film, title: "Recordings and replays", text: "Record to your computer while you present, then share a replay page with registrants." },
  { icon: Ticket, title: "Free or paid events", text: "Charge a ticket price in ₹ through your own Razorpay account.", soon: true },
  { icon: Gift, title: "Offers during the session", text: "Show an offer card or a booking link at the right moment and see who clicked.", soon: true },
  { icon: Repeat, title: "Automated webinars", text: "Run a prerecorded session on a schedule, clearly labelled as prerecorded.", soon: true },
  { icon: BarChart3, title: "Analytics that explain", text: "Attendance, watch time and offer clicks, per webinar.", soon: true },
];

const DEMOS: Record<FeatureDemoKind, { title: string; text: string; soon?: boolean }> = {
  registration: { title: "Registration", text: "Someone fills in your form, submits it and gets an instant confirmation email." },
  poll: { title: "Live polls", text: "Launch a poll, watch votes arrive and show the result on stage." },
  engagement: { title: "Engagement", text: "Chat, emoji reactions and raised hands without covering your slides." },
  recording: { title: "Recordings", text: "Recording runs on your computer while you present and is saved as you go." },
  conversion: { title: "Offers", text: "Publish your offer, attendees see it on stage and reserve a seat.", soon: true },
};

const COMPARE: [string, string, string][] = [
  ["Webinars", "One per account", "Unlimited"],
  ["Attendees per webinar", `Up to ${FREE_ATTENDEE_LIMIT}`, "Unlimited*"],
  ["Studio: slides, screen sharing, camera", "Included", "Included"],
  ["Chat, Q&A, polls, reactions, hand raise", "Included", "Included"],
  ["Registration page, custom questions, approvals", "Included", "Included"],
  ["Confirmation and reminder emails", "Included", "Included"],
  ["Record to your computer, replay page", "Included", "Included"],
  ["Paid tickets, offers, automated webinars, analytics", "Coming soon", "Coming soon"],
];

export default function FeaturesPage() {
  return (
    <>
      <Section>
        <SectionHead
          as="h1"
          overline="Features"
          title="Everything you need to host, engage and sell"
          lead="One product for the whole webinar: the page people register on, the room they learn in, and the follow-up that turns them into clients."
        />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text, soon }) => (
            <div key={title} className="flex flex-col gap-2 rounded-xl border bg-card p-6 shadow-card">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="grid size-10 place-items-center rounded-md bg-teal-subtle text-teal">
                  <Icon aria-hidden className="size-5" />
                </span>
                {soon && <ComingSoon />}
              </div>
              <h2 className="t-title">{title}</h2>
              <p className="text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="pt-0 md:pt-0">
        <SectionHead
          overline="See it in action"
          title="What each feature does, in a few seconds"
          lead="Short loops of the real flows. Names and numbers are sample data."
        />
        <div className="mg-demos">
          {FEATURE_DEMO_KINDS.map((kind) => (
            <div key={kind} className="mg-demo-card rounded-xl border bg-card shadow-card">
              <FeatureDemo kind={kind} />
              <div className="grid gap-2 p-6 pt-3">
                <h3 className="t-title flex flex-wrap items-center gap-2">
                  {DEMOS[kind].title}
                  {DEMOS[kind].soon && <ComingSoon />}
                </h3>
                <p className="text-sm text-muted-foreground">{DEMOS[kind].text}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section alt>
        <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-8 lg:grid-cols-2 lg:gap-14">
          <div className="flex flex-col gap-4">
            <span className="eyebrow">The studio</span>
            <h2 className="t-h1">A calm studio for teaching</h2>
            <p className="t-lead text-pretty">
              Share your slides or screen with your camera in the corner, spotlight a question, and put a poll on everyone&apos;s screen.
              Check your camera and mic before you go live.
            </p>
            <Button asChild className="w-fit">
              <Link href="/signup">Start free and try it</Link>
            </Button>
          </div>
          <StudioPreview />
        </div>
      </Section>

      <Section>
        <SectionHead title="Compared by plan" lead="Both plans have every feature. They differ in limits." />
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted text-left text-xs text-muted-foreground">
                <th scope="col" className="border-b px-4 py-2.5 font-medium">Feature</th>
                <th scope="col" className="border-b px-4 py-2.5 font-medium">Free</th>
                <th scope="col" className="border-b px-4 py-2.5 font-medium">Pro</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map(([f, free, pro]) => (
                <tr key={f} className="border-b last:border-b-0">
                  <th scope="row" className="px-4 py-3 text-left font-normal">{f}</th>
                  <td className="px-4 py-3">{free}</td>
                  <td className="px-4 py-3">{pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">*Subject to available streaming capacity.</p>
      </Section>
    </>
  );
}
