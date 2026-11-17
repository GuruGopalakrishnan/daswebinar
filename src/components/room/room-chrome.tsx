"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronLeft, LogIn, ShieldX, Users, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-client-values";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WebinarStatus } from "@/lib/webinars/types";
import type { Panel } from "./dock";

/*
 * Presentational pieces of the live room (top bar, side drawer, end / no-access
 * overlay). They take plain props, so the room and the /dev/ui/room preview
 * render the same markup. No realtime, media or Agora logic lives here.
 */

const pill = "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium";

export function RoomTopBar({
  title,
  backHref,
  onBack,
  status,
  startedAt,
  isHost,
  recording,
  reconnecting,
  network,
  liveCount,
  hidden,
}: {
  title: string;
  backHref: string;
  onBack?: () => void;
  status: WebinarStatus;
  startedAt: string | null;
  isHost: boolean;
  recording: boolean;
  reconnecting: boolean;
  /** Agora network quality; only shown while live. */
  network: number;
  liveCount: number;
  /** Attendees watching: chrome fades out while idle. */
  hidden?: boolean;
}) {
  return (
    <header
      className={cn(
        "absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-gradient-to-b from-stage/90 via-stage/50 to-transparent p-3 pb-8 text-white transition-opacity duration-300 sm:gap-3 sm:p-4 sm:pb-10",
        hidden && "pointer-events-none opacity-0",
      )}
    >
      <Link
        href={backHref}
        onClick={onBack}
        aria-label={isHost ? "Back to webinar" : "Leave room"}
        className="flex size-9 shrink-0 items-center justify-center rounded-md text-white/80 transition-colors duration-[180ms] hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ChevronLeft className="size-5" />
      </Link>
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="min-w-0 truncate text-sm font-semibold sm:text-[15px]">{title}</h1>
        <StatusPill status={status} startedAt={startedAt} isHost={isHost} />
        {recording && (
          <span className={cn(pill, "bg-black/45 font-semibold tracking-[0.04em] backdrop-blur")} title="This session is being recorded">
            <span className="size-2 animate-pulse rounded-full bg-live" aria-hidden /> REC
          </span>
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {reconnecting && (
          <span className={cn(pill, "bg-warning-subtle text-warning-text")} role="status">
            <WifiOff className="size-3.5" /> <span className="hidden sm:inline">Reconnecting…</span>
          </span>
        )}
        {status === "live" && <NetworkBars quality={network} />}
        <span className={cn(pill, "bg-black/45 backdrop-blur")} aria-label={`${liveCount.toLocaleString()} in the room`}>
          <Users className="size-3.5 text-white/70" /> <span className="tabular-nums">{liveCount.toLocaleString()}</span>
        </span>
      </div>
    </header>
  );
}

function StatusPill({ status, startedAt, isHost }: { status: WebinarStatus; startedAt: string | null; isHost: boolean }) {
  const now = useNow();
  if (status === "live") {
    return (
      <span className={cn(pill, "bg-live font-semibold tracking-[0.04em] text-white")}>
        <span className="size-1.5 animate-pulse rounded-full bg-white" aria-hidden />
        LIVE
        {startedAt && now !== null && (
          <span className="font-mono font-medium tabular-nums opacity-90">{formatClock((now - new Date(startedAt).getTime()) / 1000)}</span>
        )}
      </span>
    );
  }
  if (status === "ended") return null;
  return (
    <span className={cn(pill, "hidden bg-white/10 text-white/80 ring-1 ring-white/10 ring-inset sm:inline-flex")}>
      {isHost ? "Preview · only you can see this" : "Waiting room"}
    </span>
  );
}

/** Agora quality 1 (excellent) … 6 (down); 0 means not measured yet. */
function NetworkBars({ quality }: { quality: number }) {
  if (!quality) return null;
  const bars = quality <= 2 ? 3 : quality <= 4 ? 2 : 1;
  const label = bars === 3 ? "Good connection" : bars === 2 ? "Unstable connection" : "Poor connection";
  const color = bars === 3 ? "bg-success" : bars === 2 ? "bg-warning" : "bg-live";
  return (
    <span className="flex h-7 items-end gap-[3px] rounded-full bg-black/45 px-2.5 py-2 backdrop-blur" title={label} aria-label={label} role="img">
      {[0, 1, 2].map((i) => (
        <span key={i} className={cn("w-[3px] rounded-full", i < bars ? color : "bg-white/25")} style={{ height: `${40 + i * 30}%` }} />
      ))}
    </span>
  );
}

export const PANEL_TITLES: Record<Panel, string> = { chat: "Chat", qna: "Questions", polls: "Polls", people: "People" };

/** Side panel on desktop; bottom sheet above the panel nav on phones. */
export function RoomDrawer({
  panel,
  count,
  onClose,
  children,
}: {
  panel: Panel | null;
  /** Optional number next to the title (people in the room, open questions). */
  count?: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence initial={false}>
      {panel && (
        <motion.aside
          key="drawer"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ type: "spring", bounce: 0, duration: 0.3 }}
          className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 flex h-[65dvh] flex-col rounded-t-2xl border-t bg-card shadow-elevated sm:bottom-0 sm:h-[70dvh] lg:static lg:z-auto lg:h-auto lg:w-[360px] lg:rounded-none lg:border-t-0 lg:border-l lg:shadow-none"
          aria-label={PANEL_TITLES[panel]}
        >
          <span aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border lg:hidden" />
          <div className="flex h-13 shrink-0 items-center gap-2 border-b px-4 lg:h-14">
            <h2 className="t-title">{PANEL_TITLES[panel]}</h2>
            {count !== undefined && count > 0 && (
              <span className="rounded-full bg-muted px-2 text-xs leading-5 font-medium text-muted-foreground tabular-nums">{count.toLocaleString()}</span>
            )}
            <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={onClose} aria-label="Close panel">
              <X />
            </Button>
          </div>
          <div className="min-h-0 flex-1">{children}</div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

export type RoomOverlayKind = "ended" | "unauthorized" | "removed" | "forbidden";

/** Full-screen card shown when the session ends or this person can't be in the room. */
export function RoomOverlay({
  kind,
  isHost,
  webinarId,
  error,
  onLeave,
}: {
  kind: RoomOverlayKind | null;
  isHost: boolean;
  webinarId: string;
  error?: string | null;
  onLeave?: () => void;
}) {
  return (
    <AnimatePresence>
      {kind && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-stage/85 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="overlay-title"
        >
          <motion.div
            initial={{ y: 12, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
            className="grid w-full max-w-sm justify-items-center gap-1.5 rounded-2xl border bg-card p-8 text-center shadow-elevated"
          >
            {kind === "ended" ? (
              <>
                <IconTile tone="teal">
                  <Check />
                </IconTile>
                <h2 id="overlay-title" className="t-h3">
                  That&apos;s a wrap
                </h2>
                <p className="text-sm text-pretty text-muted-foreground">
                  {isHost ? "Great session. Your attendees have been told it's over." : "Thanks for joining. The host has ended the session."}
                </p>
                <Button asChild size="lg" className="mt-5 w-full">
                  <Link href={isHost ? `/dashboard/webinars/${webinarId}` : "/my-events"} onClick={onLeave}>
                    {isHost ? "Back to webinar" : "Done"}
                  </Link>
                </Button>
              </>
            ) : kind === "unauthorized" ? (
              <>
                <IconTile tone="muted">
                  <LogIn />
                </IconTile>
                <h2 id="overlay-title" className="t-h3">
                  Session expired
                </h2>
                <p className="text-sm text-muted-foreground">Log in again to rejoin the room.</p>
                <Button asChild size="lg" className="mt-5 w-full">
                  <Link href={`/login?next=${encodeURIComponent(`/room/${webinarId}`)}`}>Log in</Link>
                </Button>
              </>
            ) : (
              <>
                <IconTile tone="danger">
                  <ShieldX />
                </IconTile>
                <h2 id="overlay-title" className="t-h3">
                  {kind === "removed" ? "You were removed" : "You can't join this room"}
                </h2>
                <p className="text-sm text-pretty text-muted-foreground">{error ?? "You don't have access to this webinar."}</p>
                <Button asChild size="lg" className="mt-5 w-full">
                  <Link href={`/register/${webinarId}`} onClick={onLeave}>
                    Back to registration
                  </Link>
                </Button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function IconTile({ tone, children }: { tone: "teal" | "muted" | "danger"; children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mb-3 flex size-12 items-center justify-center rounded-xl [&_svg]:size-6",
        tone === "teal" && "bg-teal-subtle text-teal",
        tone === "muted" && "bg-muted text-foreground",
        tone === "danger" && "bg-destructive-subtle text-destructive",
      )}
    >
      {children}
    </span>
  );
}

/** Empty state inside a room panel: soft teal tile, one line of title, one line of help. */
export function PanelEmpty({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 px-6 py-8 text-center">
      <span aria-hidden className="mb-2 flex size-10 items-center justify-center rounded-xl bg-teal-subtle text-teal">
        <Icon className="size-5" />
      </span>
      <p className="text-sm font-semibold">{title}</p>
      {children && <p className="max-w-60 text-sm text-pretty text-muted-foreground">{children}</p>}
    </div>
  );
}

/** "Host" label next to a name in chat, Q&A and the people list. */
export function HostTag() {
  return <span className="rounded-sm bg-teal-subtle px-1 text-[10px] leading-4 font-semibold tracking-[0.04em] text-teal uppercase">Host</span>;
}
