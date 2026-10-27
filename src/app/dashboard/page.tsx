import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, CalendarClock, Plus, Radio, Sparkles, Users, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Reveal } from "@/components/motion";
import { WebinarList, type WebinarListItem } from "@/components/dashboard/webinar-list";
import { requireUser } from "@/lib/auth";
import { listHostWebinars } from "@/lib/webinars/queries";
import { getMyPlan } from "@/lib/billing/server";
import { FREE_ATTENDEE_LIMIT, PRO_PRICE_INR, formatInr } from "@/lib/billing/plans";
import { formatDateTime, formatRelative } from "@/lib/format";
import { requestTime } from "@/lib/request-time";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
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

  const stats = [
    { label: "Live now", value: live.length, icon: Radio, accent: live.length > 0 ? "text-live" : undefined },
    { label: "Upcoming", value: upcoming.length, icon: CalendarClock },
    { label: "Registrations", value: totalRegistrations, icon: Users },
    { label: "Total webinars", value: webinars.length, icon: Video },
  ];

  return (
    <div className="grid gap-8">
      <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Good to see you, {firstName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {next
              ? `Your next webinar, “${next.title}”, starts ${formatRelative(next.startsAt, now)}.`
              : "Nothing scheduled yet — create a webinar to get started."}
          </p>
        </div>
        {atFreeLimit ? (
          <Button asChild variant="outline">
            <Link href="/dashboard/billing">
              <Sparkles /> Upgrade for more webinars
            </Link>
          </Button>
        ) : (
          <Button asChild>
            <Link href="/dashboard/webinars/new">
              <Plus /> New webinar
            </Link>
          </Button>
        )}
      </Reveal>

      {plan.plan === "free" && (
        <Reveal>
          <Link
            href="/dashboard/billing"
            className="group flex flex-col gap-3 rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40 sm:flex-row sm:items-center"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{atFreeLimit ? "You've used your free webinar" : "You're on the free plan"}</p>
              <p className="text-sm text-muted-foreground">
                Free includes 1 webinar with up to {FREE_ATTENDEE_LIMIT} attendees. Pro is {formatInr(PRO_PRICE_INR)}/month
                for unlimited webinars and attendees.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
              See Pro <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </Link>
        </Reveal>
      )}

      {live[0] && (
        <Reveal>
          <Link
            href={`/room/${live[0].id}`}
            className="group flex items-center gap-4 rounded-xl border border-live/30 bg-live/10 p-4 transition-colors hover:bg-live/15"
          >
            <span className="relative flex size-10 items-center justify-center rounded-full bg-live text-white">
              <span className="absolute inset-0 animate-ping rounded-full bg-live/40" />
              <Radio className="relative size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-live uppercase">Live now</p>
              <p className="truncate font-medium">{live[0].title}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-medium">
              Return to room <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </Link>
        </Reveal>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.04} className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              {s.label}
              <s.icon className={`size-4 ${s.accent ?? ""}`} />
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{s.value.toLocaleString()}</p>
          </Reveal>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <QuickAction href="/dashboard/webinars/new" icon={Plus} title="Schedule a webinar" body="Set a time, capacity and signup questions." />
        <QuickAction
          href={next ? `/dashboard/webinars/${next.id}` : "/dashboard/webinars/new"}
          icon={Users}
          title="Review registrations"
          body={next ? `See who's coming to “${next.title}”.` : "Registrations appear once you publish."}
        />
        <QuickAction
          href={next ? `/room/${next.id}` : "/dashboard/webinars/new"}
          icon={Video}
          title="Open a green room"
          body="Check your camera and mic before going live."
        />
      </div>

      <section aria-labelledby="webinars-heading" className="grid gap-3">
        <h2 id="webinars-heading" className="text-sm font-medium text-muted-foreground">
          Your webinars
        </h2>
        <WebinarList items={items} />
      </section>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  body,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{body}</span>
      </span>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-8" aria-busy>
      <Skeleton className="h-14 w-80" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}
