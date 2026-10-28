import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { Badge } from "@/components/ui/badge";
import { ManageView } from "@/components/webinar/manage-view";
import type { MyPlan } from "@/lib/billing/plans";
import type { RecordingDto, RegistrationDto, WebinarDto } from "@/lib/webinars/dto";
import { requestTime } from "@/lib/request-time";

export const metadata: Metadata = { title: "Manage preview", robots: { index: false } };

/* DEVELOPMENT ONLY: the real manage-page components with labelled SAMPLE props. 404 in production. */

export default function ManagePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={null}>
      <Preview />
    </Suspense>
  );
}

async function Preview() {
  const now = await requestTime();
  const iso = (h: number) => new Date(now + h * 3_600_000).toISOString();
  const webinar: WebinarDto = {
    id: "00000000-0000-0000-0000-000000000001",
    hostId: "sample-host",
    title: "Growth Masterclass for Coaches",
    description: "A practical session on turning followers into booked calls: one lead magnet, a three-email follow-up and a single booking link.",
    startsAt: iso(50),
    durationMinutes: 60,
    timezone: "Asia/Kolkata",
    status: "scheduled",
    visibility: "unlisted",
    requiresApproval: true,
    capacity: null,
    customFields: [],
    startedAt: null,
    endedAt: null,
    createdAt: iso(-48),
    updatedAt: iso(-2),
  };
  const people = ["Priya Sharma", "Rahul Verma", "Sneha Iyer", "Arjun Mehta", "Kavya Nair"];
  const registrations: RegistrationDto[] = people.map((name, i) => ({
    id: `sample-reg-${i}`,
    webinarId: webinar.id,
    userId: null,
    email: `${name.toLowerCase().replace(" ", ".")}@example.com`,
    fullName: name,
    status: i < 2 ? "pending" : "approved",
    answers: {},
    joinToken: `sample-token-${i}`,
    createdAt: iso(-10 * (i + 1)),
    updatedAt: iso(-10 * (i + 1)),
  }));
  const recordings: RecordingDto[] = [];
  const plan: MyPlan = { plan: "free", status: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, webinarCount: 1, webinarsRun: 0, attendeeCap: 100 };

  return (
    <AppShell foot={null}>
      <div className="border-b bg-warning-subtle px-4 py-2 md:px-8">
        <Badge variant="sample">Sample data · dev preview</Badge>
      </div>
      <div className="mx-auto w-full max-w-[1264px] px-4 py-7 md:px-8">
        <ManageView webinar={webinar} registrations={registrations} recordings={recordings} plan={plan} />
      </div>
    </AppShell>
  );
}
