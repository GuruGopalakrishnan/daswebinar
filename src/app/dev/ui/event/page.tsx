import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventShell } from "@/components/event/event-shell";
import { EventView } from "@/components/event/event-view";
import { Badge } from "@/components/ui/badge";
import type { PublicWebinarDto, RegistrationDto } from "@/lib/webinars/dto";
import { requestTime } from "@/lib/request-time";

export const metadata: Metadata = { title: "Event page preview", robots: { index: false } };

/* DEVELOPMENT ONLY: the real event page components with labelled SAMPLE props. 404 in production. */

const STATES = ["open", "approval", "registered", "pending", "rejected", "full", "live", "ended"] as const;
type State = (typeof STATES)[number];

export default function EventPreviewPage({ searchParams }: PageProps<"/dev/ui/event">) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={null}>
      <Preview searchParams={searchParams} />
    </Suspense>
  );
}

async function Preview({ searchParams }: Pick<PageProps<"/dev/ui/event">, "searchParams">) {
  const params = await searchParams;
  const state: State = STATES.includes(params.state as State) ? (params.state as State) : "open";
  const now = await requestTime();
  const webinar: PublicWebinarDto = {
    id: "00000000-0000-0000-0000-000000000001",
    title: "Growth Masterclass for Coaches",
    description:
      "Learn the three-part system coaches use to turn followers into booked calls:\n\n• One clear lead magnet\n• A three-email follow-up\n• A single booking link\n\nBring your questions. There's live Q&A at the end.",
    startsAt: new Date(now + (state === "live" ? -0.2 : state === "ended" ? -48 : 50) * 3_600_000).toISOString(),
    durationMinutes: 60,
    timezone: "Asia/Kolkata",
    status: state === "live" ? "live" : state === "ended" ? "ended" : "scheduled",
    requiresApproval: state === "approval" || state === "pending",
    hostName: "Ananya Rao",
    isFull: state === "full",
    customFields: [
      { id: "goal", label: "What's your biggest challenge right now?", type: "select", required: false, options: ["Getting leads", "Converting leads", "Pricing my offer"] },
    ],
    registeredCount: 48,
  };
  const regStatus = state === "registered" || state === "live" ? "approved" : state === "pending" ? "pending" : state === "rejected" ? "rejected" : null;
  const registration: RegistrationDto | null = regStatus
    ? {
        id: "sample-reg",
        webinarId: webinar.id,
        userId: "sample-user",
        email: "priya@example.com",
        fullName: "Priya Sharma",
        status: regStatus,
        answers: {},
        joinToken: "00000000-0000-0000-0000-0000000000aa",
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
      }
    : null;

  return (
    <EventShell hostName={webinar.hostName} sessionNav={registration !== null}>
      <div className="flex flex-wrap items-center gap-2 border-b bg-warning-subtle px-4 py-2 text-xs md:px-6">
        <Badge variant="sample">Sample data · dev preview</Badge>
        {STATES.map((s) => (
          <Link key={s} href={`/dev/ui/event?state=${s}`} aria-current={s === state ? "page" : undefined} className="rounded px-2 py-1 font-medium aria-[current=page]:bg-card">
            {s}
          </Link>
        ))}
      </div>
      <EventView
        webinar={webinar}
        registration={registration}
        isHost={false}
        account={null}
        hasSession={registration !== null}
        pagePath="/e/growth-masterclass-for-coaches"
      />
    </EventShell>
  );
}
