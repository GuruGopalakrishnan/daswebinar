"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  BarChart3,
  ChevronLeft,
  Loader2,
  MessageCircleQuestion,
  MessageSquare,
  Users,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { StatusBadge } from "@/components/webinar/status-badge";
import { useNow } from "@/hooks/use-client-values";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WebinarStatus } from "@/lib/webinars/types";
import { ChatPanel } from "./chat-panel";
import { Controls } from "./controls";
import { PeoplePanel } from "./people-panel";
import { PollsPanel } from "./polls-panel";
import { QnaPanel } from "./qna-panel";
import { SettingsDialog } from "./settings-dialog";
import { Stage } from "./stage";
import { useAudioLevel, useLocalMedia } from "./use-local-media";
import { useRoom } from "./use-room";

export type RoomWebinar = {
  id: string;
  title: string;
  hostName: string;
  startsAt: string;
  status: WebinarStatus;
  startedAt: string | null;
};

type Tab = "chat" | "qna" | "polls" | "people";

export function Room({ webinar, isHost }: { webinar: RoomWebinar; isHost: boolean }) {
  const router = useRouter();
  const { state, actions } = useRoom(webinar.id);
  const media = useLocalMedia();
  const micLevel = useAudioLevel(media.mic);

  const [status, setStatus] = useState<WebinarStatus>(webinar.status);
  const [startedAt, setStartedAt] = useState(webinar.startedAt);
  const [tab, setTab] = useState<Tab>("chat");
  const [seenMessages, setSeenMessages] = useState(0);
  const [seenQuestions, setSeenQuestions] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [busy, setBusy] = useState<null | "live" | "end">(null);

  // Attendees learn about lifecycle changes from the host's broadcast.
  const effectiveStatus: WebinarStatus = state.broadcastStatus ?? status;

  useEffect(() => {
    if (media.error === "denied") toast.error("Camera or microphone access was blocked. Allow it in your browser's site settings.");
    else if (media.error === "unavailable") toast.error("No camera or microphone was found.");
  }, [media.error]);

  function switchTab(next: Tab) {
    if (tab === "chat") setSeenMessages(state.messages.length);
    if (tab === "qna") setSeenQuestions(state.questions.length);
    setTab(next);
  }

  const unreadChat = tab === "chat" ? 0 : Math.max(0, state.messages.length - seenMessages);
  const newQuestions = tab === "qna" ? 0 : Math.max(0, state.questions.length - seenQuestions);
  const openPolls = state.polls.filter((p) => !p.closed && p.myVote === null).length;
  const myHandRaised = state.handRaises.some((h) => h.userId === state.me?.userId);

  async function lifecycle(kind: "start" | "end") {
    setBusy(kind === "start" ? "live" : "end");
    try {
      const res = await fetch(`/api/webinars/${webinar.id}/${kind}`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Something went wrong.");
        return;
      }
      if (kind === "start") {
        setStatus("live");
        setStartedAt(new Date().toISOString());
        void actions.announce("live");
        toast.success("You're live!");
      } else {
        setStatus("ended");
        void actions.announce("ended");
        setConfirmEnd(false);
      }
    } finally {
      setBusy(null);
    }
  }

  async function toggleHand() {
    const res = myHandRaised ? await actions.lowerHand() : await actions.raiseHand();
    if (!res.ok) toast.error(res.error.message);
    else if (!myHandRaised) toast("Hand raised", { description: "The host can see you're waiting." });
  }

  async function react(emoji: Parameters<typeof actions.react>[0]) {
    const res = await actions.react(emoji);
    if (!res.ok && res.error.code !== "rate_limited") toast.error(res.error.message);
  }

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }>; badge: number }[] = [
    { id: "chat", label: "Chat", icon: MessageSquare, badge: unreadChat },
    { id: "qna", label: "Q&A", icon: MessageCircleQuestion, badge: newQuestions },
    { id: "polls", label: "Polls", icon: BarChart3, badge: isHost ? 0 : openPolls },
    { id: "people", label: "People", icon: Users, badge: isHost ? state.handRaises.length : 0 },
  ];

  const blocked = state.connection === "unauthorized" || state.connection === "forbidden";

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-3 sm:px-4">
        <Button asChild variant="ghost" size="icon-sm" aria-label="Back">
          <Link href={isHost ? `/dashboard/webinars/${webinar.id}` : `/register/${webinar.id}`}>
            <ChevronLeft />
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h1 className="truncate text-sm font-medium sm:text-base">{webinar.title}</h1>
          <StatusBadge status={effectiveStatus} className="shrink-0" />
          {isHost && effectiveStatus === "live" && startedAt && <Elapsed since={startedAt} />}
        </div>
        <ConnectionPill connection={state.connection} />
        <span className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground sm:inline-flex" aria-label={`${state.liveCount} in the room`}>
          <Users className="size-3.5" /> <span className="tabular-nums">{state.liveCount.toLocaleString()}</span>
        </span>
        <ThemeToggle />
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Stage + controls */}
        <section className="flex min-h-0 flex-col gap-3 p-3 lg:flex-1 lg:p-4" aria-label="Stage">
          <div className="aspect-video w-full lg:aspect-auto lg:min-h-0 lg:flex-1">
            <Stage
              isHost={isHost}
              status={effectiveStatus}
              hostName={webinar.hostName}
              startsAt={webinar.startsAt}
              camera={media.camera}
              screen={media.screen}
              micOn={media.mic !== null}
              micLevel={micLevel}
              bursts={state.bursts}
              onBurstDone={actions.burstDone}
            />
          </div>
          <Controls
            isHost={isHost}
            status={effectiveStatus}
            micOn={media.mic !== null}
            camOn={media.camera !== null}
            sharing={media.screen !== null}
            canShareScreen={media.canShareScreen}
            micLevel={micLevel}
            handRaised={myHandRaised}
            handRaiseEnabled={state.settings?.handRaiseEnabled ?? true}
            reactionsEnabled={state.settings?.reactionsEnabled ?? true}
            onToggleMic={() => void media.toggleMic()}
            onToggleCam={() => void media.toggleCamera()}
            onToggleScreen={() => void media.toggleScreen()}
            onReact={(e) => void react(e)}
            onToggleHand={() => void toggleHand()}
            onOpenSettings={() => setSettingsOpen(true)}
            onGoLive={() => void lifecycle("start")}
            onEnd={() => setConfirmEnd(true)}
            onLeave={() => router.push(`/register/${webinar.id}`)}
            goingLive={busy === "live"}
          />
        </section>

        {/* Sidebar */}
        <aside className="flex min-h-0 flex-1 flex-col border-t bg-card/40 lg:w-[380px] lg:flex-none lg:border-t-0 lg:border-l" aria-label="Interaction">
          <div role="tablist" aria-label="Room panels" className="grid shrink-0 grid-cols-4 gap-1 border-b p-1.5">
            {tabs.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={active}
                  aria-controls={`panel-${t.id}`}
                  onClick={() => switchTab(t.id)}
                  className={cn(
                    "relative flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-colors",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {active && <motion.span layoutId="room-tab" className="absolute inset-0 rounded-md bg-accent" transition={{ type: "spring", bounce: 0.15, duration: 0.3 }} />}
                  <t.icon className="relative size-4" />
                  <span className="relative">{t.label}</span>
                  <AnimatePresence>
                    {t.badge > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className={cn(
                          "relative min-w-4 rounded-full px-1 text-[10px] leading-4 text-white tabular-nums",
                          t.id === "people" ? "bg-warning text-black" : "bg-primary",
                        )}
                      >
                        {t.badge > 99 ? "99+" : t.badge}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              );
            })}
          </div>

          <div className="relative min-h-0 flex-1">
            {state.connection === "connecting" && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80 backdrop-blur-sm">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {(["chat", "qna", "polls", "people"] as const).map((id) => (
              <div key={id} role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={tab !== id} className="h-full">
                {id === "chat" && <ChatPanel messages={state.messages} me={state.me} settings={state.settings} actions={actions} />}
                {id === "qna" && <QnaPanel questions={state.questions} me={state.me} settings={state.settings} actions={actions} />}
                {id === "polls" && <PollsPanel polls={state.polls} me={state.me} actions={actions} />}
                {id === "people" && <PeoplePanel members={state.members} handRaises={state.handRaises} me={state.me} actions={actions} />}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {isHost && (
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={state.settings} actions={actions} />
      )}

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End the webinar for everyone?</AlertDialogTitle>
            <AlertDialogDescription>
              Attendees will see that the session has ended. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "end"}>Keep going</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy === "end"}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void lifecycle("end");
              }}
            >
              {busy === "end" && <Loader2 className="animate-spin" />} End webinar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AnimatePresence>
        {(effectiveStatus === "ended" || blocked) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-6 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="overlay-title"
          >
            <motion.div initial={{ y: 12, scale: 0.98 }} animate={{ y: 0, scale: 1 }} className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-2xl">
              {effectiveStatus === "ended" ? (
                <>
                  <p className="text-3xl" aria-hidden>👋</p>
                  <h2 id="overlay-title" className="mt-3 text-lg font-semibold">This webinar has ended</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Thanks for joining{isHost ? " — great session!" : "!"}</p>
                  <Button asChild className="mt-6 w-full">
                    <Link href={isHost ? `/dashboard/webinars/${webinar.id}` : "/"}>{isHost ? "Back to webinar" : "Done"}</Link>
                  </Button>
                </>
              ) : state.connection === "unauthorized" ? (
                <>
                  <h2 id="overlay-title" className="text-lg font-semibold">Session expired</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Log in again to rejoin the room.</p>
                  <Button asChild className="mt-6 w-full">
                    <Link href={`/login?next=${encodeURIComponent(`/room/${webinar.id}`)}`}>Log in</Link>
                  </Button>
                </>
              ) : (
                <>
                  <h2 id="overlay-title" className="text-lg font-semibold">You can&apos;t join this room</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{state.error ?? "You don't have access to this webinar."}</p>
                  <Button asChild className="mt-6 w-full">
                    <Link href={`/register/${webinar.id}`}>Go to registration</Link>
                  </Button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Elapsed({ since }: { since: string }) {
  const now = useNow();
  if (now === null) return null;
  return (
    <span className="hidden font-mono text-xs text-muted-foreground tabular-nums sm:inline" aria-label="Time live">
      {formatClock((now - new Date(since).getTime()) / 1000)}
    </span>
  );
}

function ConnectionPill({ connection }: { connection: string }) {
  if (connection !== "reconnecting" && connection !== "error") return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-xs text-warning" role="status">
      <WifiOff className="size-3.5" /> Reconnecting…
    </span>
  );
}
