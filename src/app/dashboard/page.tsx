import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, CalendarClock, Plus, Radio, Sparkles, Users, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/copy-button";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Reveal } from "@/components/motion";
import { WebinarList, type WebinarListItem } from "@/components/dashboard/webinar-list";
import { OnboardingChecklist, type OnboardingStep } from "@/components/dashboard/onboarding-checklist";
import { requireUser } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { listHostWebinars } from "@/lib/webinars/queries";
import { getMyPlan } from "@/lib/billing/server";
import { FREE_ATTENDEE_LIMIT, PRO_PRICE_INR, formatInr } from "@/lib/billing/plans";
import { formatDateTime, formatRelative } from "@/lib/format";
import { requestTime } from "@/lib/request-time";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

async function DashboardContent() {
  const user = await requireUser("/dashboard");
  const [webinars, plan] = await Promise.all([listHostWebinars(user.id), getMyPlan()]);
  // Free plan: one webinar. Mirrors the database rule (see migrations).
  const atFreeLimit = plan.plan === "free" && (plan.webinarCount > 0 || plan.webinarsRun > 0);
  const now = await requestTime();
  const firstName =
    ((user.user_metadata?.full_name as string | undefined) ?? "").trim().split(/\s+/)[0] || "there";

  const live = webinars.filter((w) => w.status === "live");
  const upcoming = webinars.filter((w) => w.status === "scheduled" && new Date(w.startsAt).getTime() > now);
  const totalRegistrations = webinars.reduce((sum, w) => sum + w.registrationCount, 0);
  const next = upcoming[0];

  // First-run guide. Each step is derived from data, never from a stored flag.
  const draft = webinars.find((w) => w.status === "draft");
  const published = live[0] ?? next ?? webinars.find((w) => w.status !== "draft" && w.status !== "cancelled");
  const steps: OnboardingStep[] = [
    {
      id: "create",
      title: "Create your first webinar",
      description: "Pick a title and a time. You can change everything later.",
      done: webinars.length > 0,
      action: (
        <Button asChild size="sm">
          <Link href="/dashboard/webinars/new">
            <Plus /> Create webinar
          </Link>
        </Button>
      ),
    },
    {
      id: "publish",
      title: "Publish it",
      description: "Publishing opens your registration page to the world.",
      done: webinars.some((w) => w.status !== "draft"),
      action: draft && (
        <Button asChild size="sm">
          <Link href={`/dashboard/webinars/${draft.id}`}>
            Review and publish <ArrowRight />
          </Link>
        </Button>
      ),
    },
    {
      id: "share",
      title: "Share your registration page",
      description: "Post the link on Instagram, WhatsApp or your email list. Your first sign-up ticks this off.",
      done: totalRegistrations > 0,
      action: published && <CopyButton value={`/register/${published.id}`} size="sm" label="Copy registration link" />,
    },
    {
      id: "live",
      title: "Go live for the first time",
      description: "Open the studio, check your camera and mic, then press Go live.",
      done: plan.webinarsRun > 0 || webinars.some((w) => w.status === "live" || w.status === "ended"),
      action: published && (
        <Button asChild size="sm">
          <Link href={`/room/${published.id}`}>
            <Video /> Open the studio
          </Link>
        </Button>
      ),
    },
  ];
  const onboarding = steps.some((s) => !s.done);
  const isNew = webinars.length === 0;

  const items: WebinarListItem[] = webinars.map((w) => ({
    id: w.id,
    title: w.title,
    status: w.status,
    startsAt: w.startsAt,
    whenLabel: formatDateTime(w.startsAt, w.timezone, { timeZoneName: "short" }),
    monthLabel: formatDateTime(w.startsAt, w.timezone, { weekday: undefined, day: undefined, hour: undefined, minute: undefined }),
    dayLabel: formatDateTime(w.startsAt, w.timezone, { weekday: undefined, month: undefined, hour: undefined, minute: undefined }),
    relativeLabel: formatRelative(w.startsAt, now),
    registrationCount: w.registrationCount,
    capacity: w.capacity,
    isPast: new Date(w.startsAt).getTime() + w.durationMinutes * 60_000 < now,
  }));

  return (
    <div className="grid min-w-0 gap-8">
      <Reveal className="min-w-0">
        <PageHeader
          title={isNew ? `Welcome to ${BRAND.name}, ${firstName}` : `Good to see you, ${firstName}`}
          description={
            isNew
              ? "Let's get your first webinar in front of an audience."
              : next
                ? `Your next webinar, “${next.title}”, starts ${formatRelative(next.startsAt, now)}.`
                : "Nothing scheduled right now."
          }
          actions={
            atFreeLimit ? (
              <Button asChild variant="outline">
                <Link href="/dashboard/billing">
                  <Sparkles /> Upgrade for more webinars
                </Link>
              </Button>
            ) : (
              !isNew && (
                <Button asChild>
                  <Link href="/dashboard/webinars/new">
                    <Plus /> New webinar
                  </Link>
                </Button>
              )
            )
          }
        />
      </Reveal>

      {live[0] && (
        <Reveal>
          <Link
            href={`/room/${live[0].id}`}
            className="group flex items-center gap-4 rounded-xl border border-live/30 bg-live/10 p-4 transition-colors hover:bg-live/15"
          >
            <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-live text-white">
              <span className="absolute inset-0 animate-ping rounded-full bg-live/40" />
              <Radio className="relative size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-live uppercase">Live now</p>
              <p className="truncate font-medium">{live[0].title}</p>
            </div>
            <span className="hidden items-center gap-1 text-sm font-medium sm:inline-flex">
              Return to room <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </Link>
        </Reveal>
      )}

      {onboarding && (
        <Reveal className="min-w-0">
          <OnboardingChecklist steps={steps} />
        </Reveal>
      )}

      {!isNew && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Live now" value={live.length} icon={Radio} tone="live" />
          <StatCard label="Upcoming" value={upcoming.length} icon={CalendarClock} hint={next ? `Next ${formatRelative(next.startsAt, now)}` : undefined} />
          <StatCard label="Registrations" value={totalRegistrations} icon={Users} hint="Across all webinars" />
          <StatCard label="Webinars" value={webinars.length} icon={Video} />
        </div>
      )}

      {plan.plan === "free" && (
        <Link
          href="/dashboard/billing"
          className="group flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:gap-4"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{atFreeLimit ? "You've used your free webinar" : "You're on the free plan"}</p>
            <p className="text-sm text-pretty text-muted-foreground">
              Free includes 1 webinar with up to {FREE_ATTENDEE_LIMIT} attendees. Pro is {formatInr(PRO_PRICE_INR)}/month for
              unlimited webinars and attendees.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
            See Pro <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </Link>
      )}

      {!isNew && (
        <section aria-labelledby="webinars-heading" className="grid min-w-0 gap-3">
          <h2 id="webinars-heading" className="text-sm font-medium text-muted-foreground">
            Your webinars
          </h2>
          <WebinarList items={items} />
        </section>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-8" aria-busy>
      <div className="grid gap-2">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}
