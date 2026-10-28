import Link from "next/link";
import { ArrowUpRight, CalendarClock, Plus, Radio, Sparkles, Users, Video, Zap } from "lucide-react";
import { SectionCard, UsageMeter } from "@/components/blocks/surfaces";
import { CopyButton } from "@/components/copy-button";
import { LifecycleScene } from "@/components/motion-graphics/lifecycle";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WebinarList, type WebinarListItem } from "@/components/dashboard/webinar-list";
import { OnboardingChecklist, type OnboardingStep } from "@/components/dashboard/onboarding-checklist";
import { freeWebinarsUsed } from "@/components/dashboard/plan-box";
import { FREE_ATTENDEE_LIMIT, FREE_WEBINAR_LIMIT, PRO_PRICE_INR, formatInr, type MyPlan } from "@/lib/billing/plans";
import { BRAND } from "@/lib/brand";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { HostWebinarListItem } from "@/lib/webinars/queries";

export type DashboardViewProps = {
  firstName: string;
  plan: MyPlan;
  webinars: HostWebinarListItem[];
  steps: OnboardingStep[];
  now: number;
};

/**
 * Dashboard body. Every number comes from the host's own webinars and get_my_plan; nothing is estimated.
 * The header's single primary button and the next-step line always point at the one most useful action.
 */
export function DashboardView({ firstName, plan, webinars, steps, now }: DashboardViewProps) {
  // Free plan: one webinar. Mirrors the database rule (see migrations).
  const atFreeLimit = plan.plan === "free" && (plan.webinarCount > 0 || plan.webinarsRun > 0);
  const live = webinars.filter((w) => w.status === "live");
  const upcoming = webinars.filter((w) => w.status === "scheduled" && new Date(w.startsAt).getTime() > now);
  const drafts = webinars.filter((w) => w.status === "draft");
  const completed = webinars.filter((w) => w.status === "ended").length;
  const totalRegistrations = webinars.reduce((sum, w) => sum + w.registrationCount, 0);
  const next = upcoming[0];
  const isNew = webinars.length === 0;
  const onboarding = steps.some((s) => !s.done);

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

  const primary = live[0] ? (
    <Button asChild cta className="bg-live text-white hover:bg-live/90">
      <Link href={`/room/${live[0].id}`}>
        <Radio /> Return to the room
      </Link>
    </Button>
  ) : atFreeLimit ? (
    <Button asChild variant="outline">
      <Link href="/upgrade">
        <Sparkles /> Upgrade for more webinars
      </Link>
    </Button>
  ) : (
    <Button asChild cta className={isNew ? "mg-nudge" : undefined}>
      <Link href="/dashboard/webinars/new">
        <Plus /> Create webinar
      </Link>
    </Button>
  );

  const nextStep = live[0] ? (
    <>
      <b>{live[0].title}</b> is live now. Return to the room to keep presenting.
    </>
  ) : next ? (
    <>
      Next up: <b>{next.title}</b> {formatRelative(next.startsAt, now)}. Share its registration link to fill seats.
    </>
  ) : drafts[0] ? (
    <>
      Publish <b>{drafts[0].title}</b> to open its registration page.
    </>
  ) : isNew ? (
    "Create your first webinar in five short steps. You can save it as a draft and finish later."
  ) : atFreeLimit ? (
    `Your free webinar is used. Upgrade to Pro (${formatInr(PRO_PRICE_INR)}/month) to schedule another.`
  ) : (
    "Create a webinar to start collecting registrations."
  );

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader
        title={isNew ? `Welcome to ${BRAND.name}, ${firstName}` : `Good to see you, ${firstName}`}
        description={
          isNew
            ? "Here's how to get your first webinar live."
            : upcoming.length
              ? `You have ${upcoming.length} upcoming webinar${upcoming.length === 1 ? "" : "s"}.`
              : "Nothing scheduled right now."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {plan.plan === "pro" ? <Badge variant="navy">Pro plan</Badge> : <Badge>Free plan</Badge>}
            {primary}
          </div>
        }
        nextStep={nextStep}
      />

      {live[0] && (
        <Link
          href={`/room/${live[0].id}`}
          className="group flex items-center gap-4 rounded-xl border border-live/30 bg-live/10 p-4 transition-colors duration-[220ms] hover:bg-live/15"
        >
          <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-live text-white">
            <span className="absolute inset-0 rounded-full bg-live/40 motion-safe:animate-ping" />
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
      )}

      {plan.plan === "free" && (
        <UsageMeter
          label={`Free webinar used: ${freeWebinarsUsed(plan)} of ${FREE_WEBINAR_LIMIT}`}
          used={freeWebinarsUsed(plan)}
          limit={FREE_WEBINAR_LIMIT}
          description={
            atFreeLimit
              ? "Upgrade to create more webinars. Your past webinar data stays."
              : `Up to ${FREE_ATTENDEE_LIMIT} attendees. Upgrade any time for unlimited webinars.`
          }
          action={
            // Navy only when upgrading is the next step; a webinar to prepare for comes first.
            <Button asChild size="sm" variant={atFreeLimit && !live[0] && !next && !onboarding ? "default" : "outline"}>
              <Link href="/upgrade">{atFreeLimit ? "Upgrade to Pro" : "See plans"}</Link>
            </Button>
          }
        />
      )}

      {isNew ? (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-3">
          <OnboardingChecklist steps={steps} className="lg:col-span-2" />
          <div className="rounded-xl border border-border/85 bg-card shadow-card">
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <LifecycleScene />
              <p className="t-title text-[17px]">Your numbers appear here</p>
              <p className="max-w-[360px] text-sm text-muted-foreground">
                Registrations and live sessions show up after your first webinar. No empty charts until then.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/how-it-works">How it works</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {onboarding && <OnboardingChecklist steps={steps} />}

          <section aria-labelledby="overview-heading" className="grid gap-3">
            <h2 id="overview-heading" className="text-base font-semibold">
              Overview
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Total webinars" value={webinars.length} icon={Video} hint={`${completed} completed`} />
              <StatCard
                label="Upcoming"
                value={upcoming.length}
                icon={CalendarClock}
                hint={next ? `Next ${formatRelative(next.startsAt, now)}` : "None scheduled"}
              />
              <StatCard label="Registrations" value={totalRegistrations} icon={Users} hint="All webinars" />
              <StatCard label="Live now" value={live.length} icon={Zap} tone="live" />
            </div>
          </section>

          <SectionCard
            title="Your webinars"
            bodyClassName="p-0 md:p-0"
            actions={
              next && <CopyButton value={`/register/${next.id}`} size="sm" label="Copy next registration link" />
            }
          >
            <WebinarList items={items} />
          </SectionCard>
        </>
      )}
    </div>
  );
}
