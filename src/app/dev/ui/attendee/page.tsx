import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventShell } from "@/components/event/event-shell";
import { JoinCard, type JoinPreview } from "@/components/event/join-card";
import { MyEventsList } from "@/components/event/my-events-list";
import { Badge } from "@/components/ui/badge";
import type { MyRegistration } from "@/lib/webinars/queries";
import { requestTime } from "@/lib/request-time";

export const metadata: Metadata = { title: "Attendee preview", robots: { index: false } };

/* DEVELOPMENT ONLY: join card and My events with labelled SAMPLE props (no join action). 404 in production. */

const VIEWS = ["join", "join-live", "join-pending", "join-rejected", "join-ended", "my-events"] as const;
type View = (typeof VIEWS)[number];

export default function AttendeePreviewPage({ searchParams }: PageProps<"/dev/ui/attendee">) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={null}>
      <Preview searchParams={searchParams} />
    </Suspense>
  );
}

async function Preview({ searchParams }: Pick<PageProps<"/dev/ui/attendee">, "searchParams">) {
  const params = await searchParams;
  const view: View = VIEWS.includes(params.view as View) ? (params.view as View) : "join";
  const now = await requestTime();
  const iso = (h: number) => new Date(now + h * 3_600_000).toISOString();
  const preview: JoinPreview = {
    webinar_id: "00000000-0000-0000-0000-000000000001",
    title: "Growth Masterclass for Coaches",
    starts_at: iso(view === "join-live" ? -0.2 : 50),
    timezone: "Asia/Kolkata",
    status: view === "join-live" ? "live" : view === "join-ended" ? "ended" : "scheduled",
    host_name: "Ananya Rao",
    attendee_name: "Priya Sharma",
    registration_status: view === "join-pending" ? "pending" : view === "join-rejected" ? "rejected" : "approved",
  };
  const items: MyRegistration[] = [
    ["Live Q&A: Building Your First Funnel", -0.3, "live", "approved"],
    ["Growth Masterclass for Coaches", 50, "scheduled", "approved"],
    ["Client Onboarding Workshop", 170, "scheduled", "pending"],
    ["Pricing Your Offer", -240, "ended", "approved"],
  ].map(([title, h, ws, rs], i) => ({
    registrationId: `sample-${i}`,
    registrationStatus: rs as MyRegistration["registrationStatus"],
    registeredAt: iso(-100),
    webinarId: `00000000-0000-0000-0000-00000000000${i}`,
    title: title as string,
    startsAt: iso(h as number),
    durationMinutes: 60,
    timezone: "Asia/Kolkata",
    webinarStatus: ws as MyRegistration["webinarStatus"],
    hostName: "Ananya Rao",
  }));

  return (
    <EventShell sessionNav={view === "my-events"}>
      <div className="flex flex-wrap items-center gap-2 border-b bg-warning-subtle px-4 py-2 text-xs md:px-6">
        <Badge variant="sample">Sample data · dev preview</Badge>
        {VIEWS.map((v) => (
          <Link key={v} href={`/dev/ui/attendee?view=${v}`} aria-current={v === view ? "page" : undefined} className="rounded px-2 py-1 font-medium aria-[current=page]:bg-card">
            {v}
          </Link>
        ))}
      </div>
      {view === "my-events" ? (
        <div className="mx-auto grid w-full max-w-[880px] gap-6 px-4 py-8 md:px-6">
          <div>
            <h1 className="t-h2">My events</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Registrations for priya@example.com.</p>
          </div>
          <MyEventsList items={items} now={now} />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[560px] px-4 py-12 md:px-6 md:py-16">
          <JoinCard preview={preview} />
        </div>
      )}
    </EventShell>
  );
}
