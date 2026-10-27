"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, Users, WifiOff, X } from "lucide-react";
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
import { useNow } from "@/hooks/use-client-values";
import { formatClock } from "@/lib/format";
import { REACTIONS } from "@/lib/realtime/protocol";
import { cn } from "@/lib/utils";
import type { WebinarStatus } from "@/lib/webinars/types";
import { ChatPanel } from "./chat-panel";
import { Dock, type Panel } from "./dock";
import { PeoplePanel } from "./people-panel";
import { PollOverlay } from "./poll-overlay";
import { PollsPanel } from "./polls-panel";
import { PreJoin } from "./prejoin";
import { QnaPanel } from "./qna-panel";
import { SettingsDialog } from "./settings-dialog";
import { ShortcutsDialog, useShortcuts } from "./shortcuts";
import { Stage } from "./stage";
import { useBroadcast } from "./use-broadcast";
import { useAudioLevel, useLocalMedia, type LocalMedia } from "./use-local-media";
import { useRecorder } from "./use-recorder";
import { useRoom } from "./use-room";

export type RoomWebinar = {
  id: string;
  title: string;
  hostName: string;
  startsAt: string;
  status: WebinarStatus;
  startedAt: string | null;
};

/** Everyone passes a device check first; then the studio mounts and connects. */
export function Room({ webinar, isHost }: { webinar: RoomWebinar; isHost: boolean }) {
  const media = useLocalMedia();
  const [joined, setJoined] = useState(false);

  if (!joined) {
    return <PreJoin isHost={isHost} title={webinar.title} name={webinar.hostName} media={media} onJoin={() => setJoined(true)} />;
  }
  return <Studio webinar={webinar} isHost={isHost} media={media} />;
}

const PANEL_TITLES: Record<Panel, string> = { chat: "Chat", qna: "Questions", polls: "Polls", people: "People" };

function Studio({ webinar, isHost, media }: { webinar: RoomWebinar; isHost: boolean; media: LocalMedia }) {
  const router = useRouter();
  const { state, actions } = useRoom(webinar.id);
  const micLevel = useAudioLevel(media.mic);

  const [status, setStatus] = useState<WebinarStatus>(webinar.status);
  const [startedAt, setStartedAt] = useState(webinar.startedAt);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [seenMessages, setSeenMessages] = useState(0);
  const [seenQuestions, setSeenQuestions] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [busy, setBusy] = useState<null | "live" | "end">(null);

  // Attendees learn about lifecycle changes from the room's realtime broadcast.
  const effectiveStatus: WebinarStatus = state.broadcastStatus ?? status;
  const live = effectiveStatus === "live";

  const broadcast = useBroadcast({
    webinarId: webinar.id,
    isHost,
    live,
    camera: media.camera,
    mic: media.mic,
    micMuted: media.micMuted,
    screen: media.screen,
    speakerId: media.speakerId,
  });

  const recorderSources = useMemo(
    () => ({ camera: media.camera, screen: media.screen, mic: media.mic, micMuted: media.micMuted, hostName: webinar.hostName }),
    [media.camera, media.screen, media.mic, media.micMuted, webinar.hostName],
  );
  const setRecordingFlag = useCallback(
    (recording: boolean) => void actions.updateSettings({ recording }),
    [actions],
  );
  const recorder = useRecorder({ webinarId: webinar.id, title: webinar.title, sources: recorderSources, onRecordingChange: setRecordingFlag });

  useEffect(() => {
    if (media.error === "denied") toast.error("Camera or microphone access is blocked. Allow it from the lock icon in the address bar.");
    else if (media.error === "in_use") toast.error("Your camera or mic is being used by another app.");
    else if (media.error === "unavailable") toast.error("A camera or microphone was disconnected.");
  }, [media.error]);

  // --- unread counts --------------------------------------------------------
  function openPanel(next: Panel | null) {
    if (panel === "chat") setSeenMessages(state.messages.length);
    if (panel === "qna") setSeenQuestions(state.questions.length);
    setPanel(next);
  }
  const togglePanel = (p: Panel) => openPanel(panel === p ? null : p);
  const unreadChat = panel === "chat" ? 0 : Math.max(0, state.messages.length - seenMessages);
  const newQuestions = panel === "qna" ? 0 : Math.max(0, state.questions.filter((q) => !q.answeredAt).length - seenQuestions);
  const openPolls = state.polls.filter((p) => !p.closed && p.myVote === null).length;
  const myHandRaised = state.handRaises.some((h) => h.userId === state.me?.userId);
  const spotlight = state.questions.find((q) => q.id === state.settings?.spotlightQuestionId) ?? null;

  // --- host micro-interactions ---------------------------------------------
  // New raised hands pop a toast so the host doesn't have to watch a panel.
  const knownHands = useRef(new Set<string>());
  useEffect(() => {
    if (!isHost) return;
    for (const h of state.handRaises) {
      if (knownHands.current.has(h.userId)) continue;
      toast(`✋ ${h.name} raised their hand`, {
        action: { label: "Lower", onClick: () => void actions.lowerHand(h.userId) },
      });
    }
    knownHands.current = new Set(state.handRaises.map((h) => h.userId));
  }, [isHost, state.handRaises, actions]);

  // "You're muted" nudge when the host talks into a muted mic.
  const loudSince = useRef<number | null>(null);
  const lastNudge = useRef(0);
  useEffect(() => {
    if (!isHost || !media.mic || !media.micMuted) {
      loudSince.current = null;
      return;
    }
    const now = Date.now();
    if (micLevel > 0.3) {
      loudSince.current ??= now;
      if (now - loudSince.current > 900 && now - lastNudge.current > 20_000) {
        lastNudge.current = now;
        toast("You're muted", {
          description: "Press M to unmute, or hold Space to talk.",
          action: { label: "Unmute", onClick: () => media.setMuted(false) },
        });
      }
    } else {
      loudSince.current = null;
    }
  }, [isHost, micLevel, media]);

  // Push to talk: hold Space while muted.
  const pttActive = useRef(false);

  // --- lifecycle ------------------------------------------------------------
  async function lifecycle(kind: "start" | "end") {
    setBusy(kind === "start" ? "live" : "end");
    try {
      // Stop recording first so the save dialog opens on this click.
      if (kind === "end" && recorder.state === "recording") await recorder.stop();
      const res = await fetch(`/api/webinars/${webinar.id}/${kind}`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        if (json?.error?.code === "plan_webinar_limit") {
          toast.error(json.error.message, { action: { label: "Upgrade", onClick: () => router.push("/dashboard/billing") } });
        } else {
          toast.error(json?.error?.message ?? "Something went wrong.");
        }
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

  async function react(emoji: (typeof REACTIONS)[number]) {
    const res = await actions.react(emoji);
    if (!res.ok && res.error.code !== "rate_limited") toast.error(res.error.message);
  }

  function toggleRecord() {
    if (recorder.state === "recording") void recorder.stop();
    else if (recorder.state === "idle") void recorder.start();
  }

  function leave() {
    media.release();
    router.push(isHost ? `/dashboard/webinars/${webinar.id}` : `/register/${webinar.id}`);
  }

  useShortcuts({
    mic: isHost ? () => void media.toggleMic() : undefined,
    camera: isHost ? () => void media.toggleCamera() : undefined,
    screen: isHost && media.canShareScreen ? () => void media.toggleScreen() : undefined,
    record: isHost && recorder.supported ? toggleRecord : undefined,
    hand: !isHost && state.settings?.handRaiseEnabled ? () => void toggleHand() : undefined,
    chat: () => togglePanel("chat"),
    qna: () => togglePanel("qna"),
    polls: () => togglePanel("polls"),
    people: () => togglePanel("people"),
    help: () => setShortcutsOpen(true),
    escape: () => openPanel(null),
    react: (i) => {
      const emoji = REACTIONS[i];
      if (emoji && (isHost || state.settings?.reactionsEnabled !== false)) void react(emoji);
    },
    pushToTalk: isHost
      ? (down) => {
          if (down && media.mic && media.micMuted) {
            pttActive.current = true;
            media.setMuted(false);
          } else if (!down && pttActive.current) {
            pttActive.current = false;
            media.setMuted(true);
          }
        }
      : undefined,
  });

  // --- auto-hide chrome for attendees while watching ------------------------
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (isHost || !live || panel) return;
    let timer = setTimeout(() => setIdle(true), 3500);
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), 3500);
    };
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      clearTimeout(timer);
      setIdle(false);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [isHost, live, panel]);
  const chromeHidden = idle && !isHost && live && !panel;

  const blocked = state.connection === "unauthorized" || state.connection === "forbidden" || state.connection === "removed";

  return (
    <div className="dark flex h-dvh overflow-hidden bg-stage text-foreground">
      {/* Stage column */}
      <div className="relative min-w-0 flex-1">
        <Stage
          isHost={isHost}
          status={effectiveStatus}
          hostName={webinar.hostName}
          startsAt={webinar.startsAt}
          camera={media.camera}
          screen={media.screen}
          micOn={media.micOn}
          micLevel={micLevel}
          broadcast={broadcast}
          bursts={state.bursts}
          onBurstDone={actions.burstDone}
          spotlight={spotlight}
        >
          <PollOverlay polls={state.polls} isHost={isHost} actions={actions} />
        </Stage>

        {/* Top bar */}
        <header
          className={cn(
            "absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/60 to-transparent p-3 text-white transition-opacity duration-300 sm:p-4",
            chromeHidden && "pointer-events-none opacity-0",
          )}
        >
          <Button asChild variant="ghost" size="icon-sm" className="text-white hover:bg-white/10 hover:text-white" aria-label="Back">
            <Link href={isHost ? `/dashboard/webinars/${webinar.id}` : `/register/${webinar.id}`} onClick={() => media.release()}>
              <ChevronLeft />
            </Link>
          </Button>
          <h1 className="min-w-0 truncate text-sm font-medium sm:text-base">{webinar.title}</h1>
          <StatusPill status={effectiveStatus} startedAt={startedAt} isHost={isHost} />
          {state.settings?.recording && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold backdrop-blur" title="This session is being recorded">
              <span className="size-2 animate-pulse rounded-full bg-live" /> REC
            </span>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {(state.connection === "reconnecting" || state.connection === "error" || broadcast.state === "reconnecting") && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/20 px-2.5 py-1 text-xs text-warning" role="status">
                <WifiOff className="size-3.5" /> Reconnecting…
              </span>
            )}
            {live && <NetworkBars quality={broadcast.network} />}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-xs backdrop-blur" aria-label={`${state.liveCount} in the room`}>
              <Users className="size-3.5" /> <span className="tabular-nums">{state.liveCount.toLocaleString()}</span>
            </span>
          </div>
        </header>

        {/* Dock */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 flex justify-center p-3 transition-all duration-300 sm:p-4",
            chromeHidden && "pointer-events-none translate-y-4 opacity-0",
          )}
        >
          <Dock
            isHost={isHost}
            status={effectiveStatus}
            media={media}
            micLevel={micLevel}
            handRaised={myHandRaised}
            handRaiseEnabled={state.settings?.handRaiseEnabled ?? true}
            reactionsEnabled={state.settings?.reactionsEnabled ?? true}
            panel={panel}
            badges={{
              chat: unreadChat || undefined,
              qna: newQuestions || undefined,
              polls: !isHost && openPolls ? "dot" : undefined,
              people: isHost ? state.handRaises.length || undefined : undefined,
            }}
            recorder={recorder}
            volume={broadcast.volume}
            onVolume={broadcast.setVolume}
            onPanel={togglePanel}
            onReact={(e) => void react(e)}
            onToggleHand={() => void toggleHand()}
            onToggleRecord={toggleRecord}
            onSettings={() => setSettingsOpen(true)}
            onShortcuts={() => setShortcutsOpen(true)}
            onGoLive={() => void lifecycle("start")}
            onEnd={() => setConfirmEnd(true)}
            onLeave={leave}
            goingLive={busy === "live"}
          />
        </div>
      </div>

      {/* Side drawer (bottom sheet on small screens) */}
      <AnimatePresence initial={false}>
        {panel && (
          <motion.aside
            key="drawer"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="fixed inset-x-0 bottom-0 z-40 flex h-[70dvh] flex-col rounded-t-3xl border-t bg-card shadow-2xl lg:static lg:z-auto lg:h-auto lg:w-[380px] lg:rounded-none lg:border-t-0 lg:border-l lg:shadow-none"
            aria-label={PANEL_TITLES[panel]}
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
              <h2 className="font-medium">{PANEL_TITLES[panel]}</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => openPanel(null)} aria-label="Close panel">
                <X />
              </Button>
            </div>
            <div className="min-h-0 flex-1">
              {panel === "chat" && <ChatPanel messages={state.messages} me={state.me} settings={state.settings} actions={actions} />}
              {panel === "qna" && (
                <QnaPanel questions={state.questions} me={state.me} settings={state.settings} actions={actions} />
              )}
              {panel === "polls" && <PollsPanel polls={state.polls} me={state.me} actions={actions} />}
              {panel === "people" && <PeoplePanel members={state.members} handRaises={state.handRaises} me={state.me} actions={actions} />}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {isHost && <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={state.settings} actions={actions} />}
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} isHost={isHost} />

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End the webinar for everyone?</AlertDialogTitle>
            <AlertDialogDescription>
              Attendees will see that the session has ended. This can&apos;t be undone.
              {recorder.state === "recording" && " Your recording will stop and you'll choose where to save it."}
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
              End webinar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AnimatePresence>
        {(effectiveStatus === "ended" || blocked) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-stage/90 p-6 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="overlay-title"
          >
            <motion.div initial={{ y: 12, scale: 0.98 }} animate={{ y: 0, scale: 1 }} className="w-full max-w-sm rounded-3xl border bg-card p-8 text-center shadow-2xl">
              {effectiveStatus === "ended" ? (
                <>
                  <p className="text-3xl" aria-hidden>👋</p>
                  <h2 id="overlay-title" className="mt-3 font-display text-3xl">That&apos;s a wrap</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isHost ? "Great session. Your attendees have been told it's over." : "Thanks for joining!"}
                  </p>
                  <Button asChild className="mt-6 w-full rounded-full">
                    <Link href={isHost ? `/dashboard/webinars/${webinar.id}` : "/"} onClick={() => media.release()}>
                      {isHost ? "Back to webinar" : "Done"}
                    </Link>
                  </Button>
                </>
              ) : state.connection === "unauthorized" ? (
                <>
                  <h2 id="overlay-title" className="text-lg font-semibold">Session expired</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Log in again to rejoin the room.</p>
                  <Button asChild className="mt-6 w-full rounded-full">
                    <Link href={`/login?next=${encodeURIComponent(`/room/${webinar.id}`)}`}>Log in</Link>
                  </Button>
                </>
              ) : (
                <>
                  <h2 id="overlay-title" className="text-lg font-semibold">
                    {state.connection === "removed" ? "You were removed" : "You can't join this room"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{state.error ?? "You don't have access to this webinar."}</p>
                  <Button asChild className="mt-6 w-full rounded-full">
                    <Link href={`/register/${webinar.id}`} onClick={() => media.release()}>
                      Back to registration
                    </Link>
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

function StatusPill({ status, startedAt, isHost }: { status: WebinarStatus; startedAt: string | null; isHost: boolean }) {
  const now = useNow();
  if (status === "live") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-live px-2.5 py-1 text-[11px] font-semibold text-white">
        <span className="size-1.5 animate-pulse rounded-full bg-white" />
        LIVE
        {startedAt && now !== null && <span className="font-mono tabular-nums">{formatClock((now - new Date(startedAt).getTime()) / 1000)}</span>}
      </span>
    );
  }
  if (status === "ended") return null;
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/80">
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
    <span className="flex h-7 items-end gap-[3px] rounded-full bg-black/45 px-2.5 py-1.5 backdrop-blur" title={label} aria-label={label} role="img">
      {[0, 1, 2].map((i) => (
        <span key={i} className={cn("w-[3px] rounded-full", i < bars ? color : "bg-white/25")} style={{ height: `${40 + i * 30}%` }} />
      ))}
    </span>
  );
}
