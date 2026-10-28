import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock, ExternalLink, Globe, Lock, Pencil, PlayCircle, ShieldCheck, Sparkles, Users, UserCheck } from "lucide-react";
import { Callout } from "@/components/blocks/callout";
import { SectionCard } from "@/components/blocks/surfaces";
import { CopyButton } from "@/components/copy-button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddRecordingDialog } from "@/components/webinar/add-recording-dialog";
import { GoLiveButton } from "@/components/webinar/go-live-button";
import { RegistrationsTable } from "@/components/webinar/registrations-table";
import { StatusBadge } from "@/components/webinar/status-badge";
import { FREE_ATTENDEE_LIMIT, type MyPlan } from "@/lib/billing/plans";
import { formatClock, formatDate, formatDuration, formatTime } from "@/lib/format";
import type { RecordingDto, RegistrationDto, WebinarDto } from "@/lib/webinars/dto";

export type ManageViewProps = {
  webinar: WebinarDto;
  registrations: RegistrationDto[];
  recordings: RecordingDto[];
  plan: MyPlan;
  /** The webinar slug once the event-slug migration is applied, else null. */
  slug?: string | null;
};

/** Manage page body: header with one room action, next step, plan seat notice, and the three tabs. */
export function ManageView({ webinar, registrations, recordings, plan, slug = null }: ManageViewProps) {
  const approved = registrations.filter((r) => r.status === "approved").length;
  const pending = registrations.filter((r) => r.status === "pending").length;
  const seatsTaken = approved + pending;
  // Warn only when the Free plan is what caps this webinar, not a smaller capacity the host chose.
  const planCapped = plan.plan === "free" && (webinar.capacity === null || webinar.capacity > FREE_ATTENDEE_LIMIT);
  // What actually limits registrations: the host's capacity, capped by the plan (mirrors webinar_attendee_limit()).
  const seatLimit = planCapped ? FREE_ATTENDEE_LIMIT : webinar.capacity;
  const capState =
    !planCapped || webinar.status === "ended" || webinar.status === "cancelled"
      ? null
      : seatsTaken >= FREE_ATTENDEE_LIMIT
        ? "full"
        : seatsTaken >= FREE_ATTENDEE_LIMIT * 0.8
          ? "near"
          : null;
  const registerPath = `/register/${webinar.id}`;
  // Friendly links resolve only for public webinars (see migration 20261030000000_event_slugs.sql).
  const eventPath = slug && webinar.visibility === "public" ? `/e/${slug}` : null;

  const nextStep =
    webinar.status === "live" ? (
      <>
        You&apos;re <b>live</b>. Return to the room to keep presenting.
      </>
    ) : webinar.status === "draft" ? (
      <>
        This is a draft. <b>Publish it</b> to open its registration page.
      </>
    ) : webinar.status === "ended" ? (
      recordings.length ? (
        "Your replay is up. Share it with registrants."
      ) : (
        <>
          Add the <b>replay link</b> in Recordings so registrants can watch it.
        </>
      )
    ) : webinar.status === "cancelled" ? (
      "This webinar was cancelled."
    ) : (
      // Pending approvals have their own callout below, so the line stays on the next action.
      <>
        <b>Share the registration link</b>, then open the green room to check your setup before you go live.
      </>
    );

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: webinar.title }]}
        title={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            {webinar.title}
            <StatusBadge status={webinar.status} className="align-middle" />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" /> {formatDate(webinar.startsAt, webinar.timezone)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" /> {formatTime(webinar.startsAt, webinar.timezone)} · {formatDuration(webinar.durationMinutes)}
            </span>
          </span>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/dashboard/webinars/${webinar.id}/edit`}>
                <Pencil /> Edit
              </Link>
            </Button>
            <GoLiveButton webinarId={webinar.id} status={webinar.status} />
          </>
        }
        nextStep={nextStep}
      />

      {pending > 0 && (
        <Callout tone="warn" icon={ShieldCheck}>
          <b className="font-semibold">{pending}</b> {pending === 1 ? "registration is" : "registrations are"} waiting for your approval.
        </Callout>
      )}

      {capState && (
        <Callout
          tone={capState === "full" ? "danger" : "warn"}
          icon={Users}
          action={
            <Button asChild size="sm" variant={capState === "full" ? "default" : "outline"}>
              <Link href="/upgrade">
                <Sparkles /> {capState === "full" ? "Upgrade to reopen" : "Remove the limit"}
              </Link>
            </Button>
          }
        >
          {capState === "full" ? (
            <>
              <b className="font-semibold">Registration is closed:</b> this webinar has reached the Free plan&apos;s {FREE_ATTENDEE_LIMIT}-attendee
              limit. New visitors see that it&apos;s full.
            </>
          ) : (
            <>
              <b className="font-semibold tabular-nums">
                {seatsTaken} of {FREE_ATTENDEE_LIMIT}
              </b>{" "}
              free seats taken. Registration closes at {FREE_ATTENDEE_LIMIT} on the Free plan.
            </>
          )}
        </Callout>
      )}

      <Tabs defaultValue={pending > 0 ? "registrations" : "overview"}>
        <TabsList variant="line" className="w-full justify-start border-b">
          <TabsTrigger value="overview" className="flex-none">
            Overview
          </TabsTrigger>
          <TabsTrigger value="registrations" className="flex-none">
            Registrations <span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground tabular-nums">{registrations.length}</span>
          </TabsTrigger>
          <TabsTrigger value="recordings" className="flex-none">
            Recordings <span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground tabular-nums">{recordings.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Registered" value={registrations.length} icon={Users} />
            <StatCard label="Approved" value={approved} icon={UserCheck} />
            <StatCard label="Awaiting approval" value={pending} icon={ShieldCheck} />
            <div className="min-w-0 rounded-xl border border-border/85 bg-card p-4 shadow-card">
              <div className="flex items-center justify-between gap-2 text-[13px] text-muted-foreground">
                <span>Seats taken</span>
                <CheckCircle2 className="size-4" />
              </div>
              <p className="mt-2 text-[28px] leading-9 font-semibold tracking-[-0.02em] tabular-nums">
                {seatLimit ? `${Math.round((seatsTaken / seatLimit) * 100)}%` : "∞"}
              </p>
              {seatLimit ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-teal" style={{ width: `${Math.min(100, (seatsTaken / seatLimit) * 100)}%` }} />
                </div>
              ) : (
                <p className="mt-0.5 text-xs text-muted-foreground">No limit</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[1.4fr_1fr]">
            <SectionCard title="Share">
              {webinar.status === "draft" ? (
                <p className="text-sm text-muted-foreground">
                  This webinar is a draft. Publish it (Edit → Schedule webinar) to open registration.
                </p>
              ) : (
                <div className="grid gap-3">
                  <p className="text-sm text-muted-foreground">Anyone with this link can register.</p>
                  <ShareRow path={eventPath ?? registerPath} />
                  {eventPath ? (
                    <p className="text-xs text-muted-foreground">
                      Friendly link for this public webinar. The longer link <code className="font-mono">{registerPath}</code> keeps working too.
                    </p>
                  ) : (
                    webinar.visibility === "unlisted" && (
                      <p className="text-xs text-muted-foreground">
                        Unlisted webinars use this private link. Friendly <code className="font-mono">/e/…</code> links are only for public webinars,
                        because they can be guessed.
                      </p>
                    )
                  )}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Settings">
              <dl className="grid gap-2.5 text-sm">
                <Row icon={webinar.visibility === "public" ? Globe : Lock} label="Visibility" value={webinar.visibility === "public" ? "Public" : "Unlisted"} />
                <Row icon={ShieldCheck} label="Approval" value={webinar.requiresApproval ? "Required" : "Automatic"} />
                <Row icon={Users} label="Capacity" value={seatLimit ? `${seatLimit.toLocaleString("en-IN")}${planCapped ? " (Free plan)" : ""}` : "Unlimited"} />
                <Row icon={Globe} label="Time zone" value={webinar.timezone.replaceAll("_", " ")} />
              </dl>
            </SectionCard>
          </div>

          {webinar.description && (
            <SectionCard title="Description">
              <p className="text-sm whitespace-pre-line text-muted-foreground">{webinar.description}</p>
            </SectionCard>
          )}
        </TabsContent>

        <TabsContent value="registrations" className="mt-4">
          <RegistrationsTable webinarId={webinar.id} registrations={registrations} fields={webinar.customFields} />
        </TabsContent>

        <TabsContent value="recordings" className="mt-4 grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Replays are visible to you and approved registrants.</p>
            <AddRecordingDialog webinarId={webinar.id} defaultTitle={webinar.title} />
          </div>
          {recordings.length === 0 ? (
            <div className="rounded-xl border border-border/85 bg-card shadow-card">
              <EmptyState icon={PlayCircle} title="No recordings yet" description="Add a replay link after your session." />
            </div>
          ) : (
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recordings.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/recordings/${r.id}`}
                    className="group block overflow-hidden rounded-xl border border-border/85 bg-card shadow-card transition-[box-shadow,transform] duration-[220ms] ease-out hover:-translate-y-0.5 hover:shadow-raise motion-reduce:hover:translate-y-0"
                  >
                    <div className="cover c4 relative flex aspect-video items-center justify-center">
                      <PlayCircle className="size-10 text-white/85 transition-transform duration-[220ms] group-hover:scale-110" />
                      {r.durationSeconds !== null && (
                        <span className="absolute right-2 bottom-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[11px] text-white">
                          {formatClock(r.durationSeconds)}
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(r.createdAt, webinar.timezone)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ShareRow({ path }: { path: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <code className="flex-1 truncate rounded-md border bg-surface-2 px-3 py-2 font-mono text-xs leading-5">{path}</code>
      <CopyButton value={path} />
      <Button asChild variant="ghost">
        <Link href={path} target="_blank">
          <ExternalLink /> Preview
        </Link>
      </Button>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" /> {label}
      </dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}
