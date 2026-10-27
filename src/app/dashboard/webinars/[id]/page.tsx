import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  CalendarDays,
  ChevronLeft,
  Clock,
  ExternalLink,
  Globe,
  Lock,
  Pencil,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/copy-button";
import { StatusBadge } from "@/components/webinar/status-badge";
import { GoLiveButton } from "@/components/webinar/go-live-button";
import { RegistrationsTable } from "@/components/webinar/registrations-table";
import { AddRecordingDialog } from "@/components/webinar/add-recording-dialog";
import { requireUser } from "@/lib/auth";
import { getMyPlan } from "@/lib/billing/server";
import { FREE_ATTENDEE_LIMIT } from "@/lib/billing/plans";
import { formatClock, formatDate, formatDuration, formatTime } from "@/lib/format";
import { getHostWebinar, isUuid, listRecordings, listRegistrations } from "@/lib/webinars/queries";

export const metadata: Metadata = { title: "Manage webinar" };

export default function ManageWebinarPage({ params }: PageProps<"/dashboard/webinars/[id]">) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Dashboard
      </Link>
      <Suspense fallback={<ManageSkeleton />}>
        <ManageContent params={params} />
      </Suspense>
    </div>
  );
}

async function ManageContent({ params }: Pick<PageProps<"/dashboard/webinars/[id]">, "params">) {
  const { id } = await params;
  await requireUser(`/dashboard/webinars/${id}`);
  if (!isUuid(id)) notFound();

  const webinar = await getHostWebinar(id);
  if (!webinar) notFound();
  const [registrations, recordings, plan] = await Promise.all([listRegistrations(id), listRecordings(id), getMyPlan()]);

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

  return (
    <div className="grid gap-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">{webinar.title}</h1>
            <StatusBadge status={webinar.status} />
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" /> {formatDate(webinar.startsAt, webinar.timezone)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" /> {formatTime(webinar.startsAt, webinar.timezone)} · {formatDuration(webinar.durationMinutes)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/dashboard/webinars/${webinar.id}/edit`}>
              <Pencil /> Edit
            </Link>
          </Button>
          <GoLiveButton webinarId={webinar.id} status={webinar.status} />
        </div>
      </div>

      {pending > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          <ShieldCheck className="size-4 text-warning" />
          <span>
            <strong className="font-medium">{pending}</strong> {pending === 1 ? "registration is" : "registrations are"} waiting for
            your approval.
          </span>
        </div>
      )}

      {capState && (
        <div
          role="status"
          className={`flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center ${capState === "full" ? "border-live/30 bg-live/10" : "border-warning/30 bg-warning/10"}`}
        >
          <Users className={`size-4 shrink-0 ${capState === "full" ? "text-live" : "text-warning"}`} />
          <p className="flex-1">
            {capState === "full" ? (
              <>
                <strong className="font-medium">Registration is closed:</strong> this webinar has reached the Free plan&apos;s{" "}
                {FREE_ATTENDEE_LIMIT}-attendee limit. New visitors see that it&apos;s full.
              </>
            ) : (
              <>
                <strong className="font-medium tabular-nums">
                  {seatsTaken} of {FREE_ATTENDEE_LIMIT}
                </strong>{" "}
                free seats taken. Registration closes at {FREE_ATTENDEE_LIMIT} on the Free plan.
              </>
            )}
          </p>
          <Button asChild size="sm" variant={capState === "full" ? "default" : "outline"}>
            <Link href="/upgrade">
              <Sparkles /> {capState === "full" ? "Upgrade to reopen" : "Remove the limit"}
            </Link>
          </Button>
        </div>
      )}

      <Tabs defaultValue={pending > 0 ? "registrations" : "overview"}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="registrations">
            Registrations <span className="ml-1 text-xs text-muted-foreground tabular-nums">{registrations.length}</span>
          </TabsTrigger>
          <TabsTrigger value="recordings">
            Recordings <span className="ml-1 text-xs text-muted-foreground tabular-nums">{recordings.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 grid gap-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Registered" value={registrations.length} />
            <Stat label="Approved" value={approved} />
            <Stat label="Awaiting approval" value={pending} />
            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">Capacity</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                {seatLimit ? `${Math.round((seatsTaken / seatLimit) * 100)}%` : "∞"}
              </p>
              {seatLimit && <Progress value={Math.min(100, (seatsTaken / seatLimit) * 100)} className="mt-3 h-1.5" />}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <section className="rounded-xl border bg-card p-5">
              <h2 className="font-medium">Share</h2>
              {webinar.status === "draft" ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  This webinar is a draft. Publish it (Edit → Schedule webinar) to open registration.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-muted-foreground">Anyone with this link can register.</p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <code className="flex-1 truncate rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs leading-5">
                      {registerPath}
                    </code>
                    <CopyButton value={registerPath} />
                    <Button asChild variant="ghost">
                      <Link href={registerPath} target="_blank">
                        <ExternalLink /> Preview
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </section>

            <section className="rounded-xl border bg-card p-5">
              <h2 className="font-medium">Settings</h2>
              <dl className="mt-3 grid gap-2.5 text-sm">
                <Row icon={webinar.visibility === "public" ? Globe : Lock} label="Visibility" value={webinar.visibility === "public" ? "Public" : "Unlisted"} />
                <Row icon={ShieldCheck} label="Approval" value={webinar.requiresApproval ? "Required" : "Automatic"} />
                <Row icon={Users} label="Capacity" value={seatLimit ? `${seatLimit.toLocaleString()}${planCapped ? " (Free plan)" : ""}` : "Unlimited"} />
                <Row icon={Globe} label="Time zone" value={webinar.timezone.replaceAll("_", " ")} />
              </dl>
            </section>
          </div>

          {webinar.description && (
            <section className="rounded-xl border bg-card p-5">
              <h2 className="font-medium">Description</h2>
              <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{webinar.description}</p>
            </section>
          )}
        </TabsContent>

        <TabsContent value="registrations" className="mt-6">
          <RegistrationsTable webinarId={webinar.id} registrations={registrations} fields={webinar.customFields} />
        </TabsContent>

        <TabsContent value="recordings" className="mt-6 grid gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Replays are visible to you and approved registrants.</p>
            <AddRecordingDialog webinarId={webinar.id} defaultTitle={webinar.title} />
          </div>
          {recordings.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-14 text-center">
              <PlayCircle className="size-6 text-muted-foreground" />
              <p className="font-medium">No recordings yet</p>
              <p className="text-sm text-muted-foreground">Add a replay link after your session.</p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recordings.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/recordings/${r.id}`}
                    className="group block overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/40"
                  >
                    <div className="relative flex aspect-video items-center justify-center bg-stage">
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,oklch(0.66_0.19_280/0.3),transparent_60%)]" />
                      <PlayCircle className="relative size-10 text-white/80 transition-transform group-hover:scale-110" />
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value.toLocaleString()}</p>
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

function ManageSkeleton() {
  return (
    <div className="grid gap-8" aria-busy>
      <Skeleton className="h-16 w-2/3" />
      <Skeleton className="h-9 w-80" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}
