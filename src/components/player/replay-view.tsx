import Link from "next/link";
import { CalendarDays, ChevronLeft, Clock, Keyboard, PlayCircle } from "lucide-react";
import { SectionCard } from "@/components/blocks/surfaces";
import { UserAvatar } from "@/components/user-avatar";
import { formatClock, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RecordingDto } from "@/lib/webinars/dto";
import { VideoPlayer } from "./video-player";

const SHORTCUTS = [
  ["Space / K", "Play / pause"],
  ["J / L", "Back / forward 10s"],
  ["← / →", "Back / forward 5s"],
  ["M", "Mute"],
  ["F", "Fullscreen"],
];

/** Replay page body (presentational). The page loads the recording through RLS and passes it in. */
export function ReplayView({
  recording,
  all,
  webinarTitle,
  timezone,
  description,
  hostName,
  backHref,
}: {
  recording: RecordingDto;
  /** Every recording of this webinar the viewer can see. */
  all: RecordingDto[];
  webinarTitle: string;
  timezone?: string | null;
  description?: string | null;
  hostName?: string | null;
  backHref: string;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <Link
          href={backHref}
          className="mb-4 inline-flex max-w-full items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronLeft className="size-4 shrink-0" /> <span className="truncate">{webinarTitle}</span>
        </Link>
        <VideoPlayer src={recording.videoUrl} title={recording.title} resumeKey={`resume:${recording.id}`} />

        <div className="mt-6">
          <p className="eyebrow">Replay</p>
          <h1 className="t-h2 mt-1">{recording.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {hostName && (
              <span className="inline-flex items-center gap-2">
                <UserAvatar name={hostName} className="size-6 text-[9px]" /> {hostName}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" /> {formatDate(recording.createdAt, timezone ?? undefined)}
            </span>
            {recording.durationSeconds !== null && (
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Clock className="size-4" /> {formatClock(recording.durationSeconds)}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-6 max-w-prose border-t pt-6 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>

      <aside className="grid content-start gap-6">
        {all.length > 1 && (
          <SectionCard title="From this webinar" bodyClassName="p-2 md:p-2">
            <ul className="grid gap-1">
              {all.map((r) => {
                const current = r.id === recording.id;
                return (
                  <li key={r.id}>
                    <Link
                      href={`/recordings/${r.id}`}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "flex gap-3 rounded-md p-2 transition-colors duration-[180ms] hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
                        current && "bg-teal-subtle hover:bg-teal-subtle",
                      )}
                    >
                      <span className="relative flex aspect-video w-24 shrink-0 items-center justify-center rounded-md bg-stage">
                        <PlayCircle className="size-5 text-white/75" />
                        {r.durationSeconds !== null && (
                          <span className="absolute right-1 bottom-1 rounded-sm bg-black/60 px-1 font-mono text-[10px] leading-4 text-white tabular-nums">
                            {formatClock(r.durationSeconds)}
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 py-0.5">
                        <span className="line-clamp-2 text-sm font-medium">{r.title}</span>
                        {current && <span className="text-xs font-medium text-teal">Now playing</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        )}

        <SectionCard
          className="hidden lg:block"
          title={
            <span className="flex items-center gap-2">
              <Keyboard className="size-4 text-muted-foreground" /> Keyboard shortcuts
            </span>
          }
        >
          <dl className="grid gap-2.5 text-sm">
            {SHORTCUTS.map(([keys, action]) => (
              <div key={keys} className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">{action}</dt>
                <dd>
                  <kbd className="rounded-sm border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">{keys}</kbd>
                </dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      </aside>
    </div>
  );
}
