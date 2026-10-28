import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { buildOnboardingSteps } from "@/components/dashboard/onboarding-steps";
import { PlanBox } from "@/components/dashboard/plan-box";
import { UserMenu } from "@/components/dashboard/user-menu";
import { Badge } from "@/components/ui/badge";
import type { MyPlan } from "@/lib/billing/plans";
import type { HostWebinarListItem } from "@/lib/webinars/queries";
import { requestTime } from "@/lib/request-time";

export const metadata: Metadata = { title: "Dashboard preview", robots: { index: false } };

/*
 * DEVELOPMENT ONLY: renders the real dashboard components with labelled SAMPLE props, because the real
 * /dashboard needs a Supabase session. 404 in production builds. Nothing here is shown to real users.
 */

const STATES = ["new", "active", "free-used", "pro", "live"] as const;
type State = (typeof STATES)[number];

const HOUR = 3_600_000;
function sampleWebinar(now: number, i: number, patch: Partial<HostWebinarListItem>): HostWebinarListItem {
  const startsAt = new Date(now).toISOString();
  return {
    id: `00000000-0000-0000-0000-00000000000${i}`,
    hostId: "sample-host",
    title: "Sample webinar",
    description: null,
    startsAt,
    durationMinutes: 60,
    timezone: "Asia/Kolkata",
    status: "scheduled",
    visibility: "unlisted",
    requiresApproval: false,
    capacity: null,
    customFields: [],
    startedAt: null,
    endedAt: null,
    createdAt: startsAt,
    updatedAt: startsAt,
    registrationCount: 0,
    ...patch,
  } as HostWebinarListItem;
}

function sample(state: State, now: number): { plan: MyPlan; webinars: HostWebinarListItem[] } {
  const free: MyPlan = { plan: "free", status: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, webinarCount: 0, webinarsRun: 0, attendeeCap: 100 };
  const iso = (h: number) => new Date(now + h * HOUR).toISOString();
  const growth = sampleWebinar(now, 1, { title: "Growth Masterclass for Coaches", startsAt: iso(50), registrationCount: 48, capacity: 100 });
  const pricing = sampleWebinar(now, 2, { title: "Pricing Your Offer Workshop", startsAt: iso(170), registrationCount: 31 });
  const past = sampleWebinar(now, 3, { title: "Live Q&A: Building Your First Funnel", startsAt: iso(-120), status: "ended", registrationCount: 64 });
  const draft = sampleWebinar(now, 4, { title: "Client Onboarding Basics", startsAt: iso(300), status: "draft" });
  switch (state) {
    case "new":
      return { plan: free, webinars: [] };
    case "free-used":
      return { plan: { ...free, webinarCount: 1, webinarsRun: 1 }, webinars: [{ ...past }] };
    case "pro":
      return {
        plan: { ...free, plan: "pro", status: "active", currentPeriodEnd: iso(24 * 20), attendeeCap: null, webinarCount: 4, webinarsRun: 1 },
        webinars: [past, growth, pricing, draft],
      };
    case "live":
      return {
        plan: { ...free, plan: "pro", status: "active", currentPeriodEnd: iso(24 * 20), attendeeCap: null, webinarCount: 2, webinarsRun: 2 },
        webinars: [{ ...growth, status: "live", startsAt: iso(-0.3), registrationCount: 48 }, pricing],
      };
    default:
      return { plan: { ...free, webinarCount: 1 }, webinars: [growth] };
  }
}

export default function DashboardPreviewPage({ searchParams }: PageProps<"/dev/ui/dashboard">) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={null}>
      <Preview searchParams={searchParams} />
    </Suspense>
  );
}

async function Preview({ searchParams }: Pick<PageProps<"/dev/ui/dashboard">, "searchParams">) {
  const params = await searchParams;
  const state: State = STATES.includes(params.state as State) ? (params.state as State) : "active";
  const now = await requestTime();
  const { plan, webinars } = sample(state, now);
  return (
    <AppShell
      foot={
        <>
          <PlanBox plan={plan} />
          <UserMenu id="sample-host" name="Ananya Rao" email="ananya@example.com" />
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b bg-warning-subtle px-4 py-2 text-xs md:px-8">
        <Badge variant="sample">Sample data · dev preview</Badge>
        {STATES.map((s) => (
          <Link key={s} href={`/dev/ui/dashboard?state=${s}`} aria-current={s === state ? "page" : undefined} className="rounded px-2 py-1 font-medium aria-[current=page]:bg-card">
            {s}
          </Link>
        ))}
      </div>
      <div className="mx-auto w-full max-w-[1264px] px-4 py-7 md:px-8">
        <DashboardView firstName="Ananya" plan={plan} webinars={webinars} steps={buildOnboardingSteps(webinars, plan, now)} now={now} />
      </div>
    </AppShell>
  );
}
