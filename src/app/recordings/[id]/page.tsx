import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarDays, ChevronLeft, Clock, Keyboard, PlayCircle } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { VideoPlayer } from "@/components/player/video-player";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { formatClock, formatDate } from "@/lib/format";
import { getHostWebinar, getPublicWebinar, getRecording, isUuid, listRecordings } from "@/lib/webinars/queries";

export const metadata: Metadata = { title: "Replay" };

const SHORTCUTS = [
  ["Space / K", "Play / pause"],
  ["J / L", "Back / forward 10s"],
  ["← / →", "Back / forward 5s"],
  ["M", "Mute"],
  ["F", "Fullscreen"],
];

export default function RecordingPage({ params }: PageProps<"/recordings/[id]">) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo href="/dashboard" />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <Suspense fallback={<RecordingSkeleton />}>
          <RecordingContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function RecordingContent({ params }: Pick<PageProps<"/recordings/[id]">, "params">) {
  const { id } = await params;
  await requireUser(`/recordings/${id}`, { allowGuest: true });
  if (!isUuid(id)) notFound();

  // RLS: only the host and approved registrants can read a recording.
  const recording = await getRecording(id);
  if (!recording) notFound();

  const [hosted, publicView, all] = await Promise.all([
    getHostWebinar(recording.webinarId),
    getPublicWebinar(recording.webinarId),
    listRecordings(recording.webinarId),
  ]);
  const webinarTitle = hosted?.title ?? publicView?.title ?? "Webinar";
  const timezone = hosted?.timezone ?? publicView?.timezone;
  const description = hosted?.description ?? publicView?.description;
  const hostName = publicView?.hostName;
  const backHref = hosted ? `/dashboard/webinars/${recording.webinarId}` : `/register/${recording.webinarId}`;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        <Link href={backHref} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> {webinarTitle}
        </Link>
        <VideoPlayer src={recording.videoUrl} title={recording.title} resumeKey={`resume:${recording.id}`} />

        <div className="mt-6">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{recording.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {hostName && (
              <span className="inline-flex items-center gap-2">
                <UserAvatar name={hostName} className="size-6 text-[9px]" /> {hostName}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" /> {formatDate(recording.createdAt, timezone)}
            </span>
            {recording.durationSeconds !== null && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" /> {formatClock(recording.durationSeconds)}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-6 max-w-prose text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{description}</p>
          )}
        </div>
      </div>

      <aside className="grid content-start gap-6">
        {all.length > 1 && (
          <section aria-labelledby="more-heading">
            <h2 id="more-heading" className="mb-3 text-sm font-medium">
              From this webinar
            </h2>
            <ul className="grid gap-2">
              {all.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/recordings/${r.id}`}
                    aria-current={r.id === recording.id ? "page" : undefined}
                    className={cn(
                      "flex gap-3 rounded-xl border p-2 transition-colors hover:bg-accent/50",
                      r.id === recording.id && "border-primary/40 bg-primary/5",
                    )}
                  >
                    <span className="flex aspect-video w-24 shrink-0 items-center justify-center rounded-lg bg-stage">
                      <PlayCircle className="size-5 text-white/70" />
                    </span>
                    <span className="min-w-0 py-0.5">
                      <span className="line-clamp-2 text-sm font-medium">{r.title}</span>
                      {r.durationSeconds !== null && (
                        <span className="font-mono text-xs text-muted-foreground">{formatClock(r.durationSeconds)}</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="hidden rounded-xl border bg-card p-4 lg:block" aria-labelledby="keys-heading">
          <h2 id="keys-heading" className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Keyboard className="size-4" /> Keyboard shortcuts
          </h2>
          <dl className="grid gap-2 text-sm">
            {SHORTCUTS.map(([keys, action]) => (
              <div key={keys} className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">{action}</dt>
                <dd>
                  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]">{keys}</kbd>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </aside>
    </div>
  );
}

function RecordingSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]" aria-busy>
      <div className="grid gap-4">
        <Skeleton className="aspect-video w-full rounded-2xl" />
        <Skeleton className="h-8 w-2/3" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
