"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, Maximize, Minimize, Users, WifiOff, X } from "lucide-react";
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
import { UpgradeDialog, type UpgradeReason } from "@/components/billing/upgrade-dialog";
import { useNow } from "@/hooks/use-client-values";
import { formatClock } from "@/lib/format";
import { REACTIONS } from "@/lib/realtime/protocol";
import { cn } from "@/lib/utils";
import type { WebinarStatus } from "@/lib/webinars/types";
import { ChatPanel } from "./chat-panel";
import { Dock, MobilePanelNav, type Panel } from "./dock";
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

/**
 * Everyone passes a device check first; then the studio mounts and connects.
 * `isPanelist` (from the server) only decides whether the device check offers
 * a camera and mic; the live role comes from the room state.
 */
export function Room({ webinar, isHost, isPanelist = false }: { webinar: RoomWebinar; isHost: boolean; isPanelist?: boolean }) {
  const media = useLocalMedia();
  const [joined, setJoined] = useState(false);

  if (!joined) {
    return (
      <PreJoin
        isHost={isHost}
        isPanelist={isPanelist}
        title={webinar.title}
        name={webinar.hostName}
        media={media}
        onJoin={() => setJoined(true)}
      />
    );
  }
  return <Studio webinar={webinar} isHost={isHost} media={media} />;
}

const PANEL_TITLES: Record<Panel, string> = { chat: "Chat", qna: "Questions", polls: "Polls", people: "People" };

function subscribeFullscreen(listener: () => void) {
  document.addEventListener("fullscreenchange", listener);
  return () => document.removeEventListener("fullscreenchange", listener);
}

function useFullscreen(ref: React.RefObject<HTMLElement | null>) {
  const active = useSyncExternalStore(subscribeFullscreen, () => document.fullscreenElement !== null, () => false);
  // iPhone Safari has no element fullscreen; the button stays hidden there.
  const supported = useSyncExternalStore(subscribeFullscreen, () => Boolean(document.fullscreenEnabled), () => false);
  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void ref.current?.requestFullscreen().catch(() => toast.error("Fullscreen isn't available here."));
  }, [ref]);
  return { active, supported, toggle };
}

function Studio({ webinar, isHost, media }: { webinar: RoomWebinar; isHost: boolean; media: LocalMedia }) {
  const router = useRouter();
  const { state, actions } = useRoom(webinar.id);
  const micLevel = useAudioLevel(media.mic);
  const rootRef = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(rootRef);

  // Roles: host from the server; panelist from the room state, so promotion
  // and demotion take effect without a reload.
  const isPanelist = !isHost && state.me?.role === "panelist";
  const canPublish = isHost || isPanelist;
  const panelists = useMemo(() => state.participants.filter((p) => p.role === "panelist"), [state.participants]);
  const speakRequests = useMemo(
    () =>
      state.participants
        .filter((p) => p.role === "attendee" && p.speakRequestedAt)
        .sort((a, b) => a.speakRequestedAt!.localeCompare(b.speakRequestedAt!)),
    [state.participants],
  );
  const mySpeakRequest = speakRequests.some((p) => p.userId === state.me?.userId);
  const practice = state.settings?.practice ?? false;

  const [status, setStatus] = useState<WebinarStatus>(webinar.status);
  const [startedAt, setStartedAt] = useState(webinar.startedAt);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [seenMessages, setSeenMessages] = useState(0);
  const [seenQuestions, setSeenQuestions] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(null);
  const [busy, setBusy] = useState<null | "live" | "end" | "practice">(null);

  // Attendees learn about lifecycle changes from the room's realtime broadcast.
  const effectiveStatus: WebinarStatus = state.broadcastStatus ?? status;
  const live = effectiveStatus === "live";
  // In practice the host and panelists are on air; attendees are not.
  const onAir = live || (practice && canPublish);

  const broadcast = useBroadcast({
    webinarId: webinar.id,
    canPublish,
    onAir,
    stageUids: panelists.flatMap((p) => (p.rtcUid ? [p.rtcUid] : [])),
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

  // Requests to speak pop a toast with a one-tap "Bring on stage".
  const knownRequests = useRef(new Set<string>());
  useEffect(() => {
    if (!isHost) return;
    for (const r of speakRequests) {
      if (knownRequests.current.has(r.userId)) continue;
      toast(`🎙️ ${r.name} asked to speak`, {
        action: {
          label: "Bring on stage",
          onClick: () =>
            void actions.setPanelist(r.userId, true).then((res) => {
              if (!res.ok) toast.error(res.error.message);
            }),
        },
      });
    }
    knownRequests.current = new Set(speakRequests.map((r) => r.userId));
  }, [isHost, speakRequests, actions]);

  // Promoted: tell them. Demoted: turn their camera and mic off right away
  // (the broadcast also rejoins as audience, so nothing more is published).
  const wasPanelist = useRef<boolean | null>(null);
  const roleKnown = state.me !== null;
  useEffect(() => {
    if (!roleKnown) return;
    // The first known role is where we start, not a change.
    if (wasPanelist.current === null) wasPanelist.current = isPanelist;
    if (wasPanelist.current === isPanelist) return;
    wasPanelist.current = isPanelist;
    if (isPanelist) {
      toast.success("You're a panelist now", {
        description: live ? "Turn on your mic or camera when you're ready." : "You'll be on air once the host starts.",
        action: { label: "Unmute", onClick: () => void media.startMic(false) },
      });
    } else {
      media.release();
      toast("You're back in the audience", { description: "The host moved you off stage." });
    }
  }, [roleKnown, isPanelist, live, media]);

  // "You're muted" nudge when someone on stage talks into a muted mic.
  const loudSince = useRef<number | null>(null);
  const lastNudge = useRef(0);
  useEffect(() => {
    if (!canPublish || !media.mic || !media.micMuted) {
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
  }, [canPublish, micLevel, media]);

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
          setUpgradeReason("live");
        } else {
          toast.error(json?.error?.message ?? "Something went wrong.");
        }
        return;
      }
      if (kind === "start") {
        setStatus("live");
        setStartedAt(new Date().toISOString());
        void actions.announce("live");
        setConfirmStart(false);
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

  async function togglePractice() {
    setBusy("practice");
    try {
      const res = await actions.setPractice(!practice);
      if (!res.ok) toast.error(res.error.message);
      else if (res.data.practice) toast("Practice started", { description: "You and your panelists are on air. Attendees still see the waiting room." });
      else toast("Practice ended");
    } finally {
      setBusy(null);
    }
  }

  async function toggleSpeak() {
    const res = await actions.requestToSpeak(!mySpeakRequest);
    if (!res.ok) toast.error(res.error.message);
    else if (!mySpeakRequest) toast("Request sent", { description: "The host will bring you on stage if they can." });
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
    mic: canPublish ? () => void media.toggleMic() : undefined,
    camera: canPublish ? () => void media.toggleCamera() : undefined,
    fullscreen: fullscreen.supported ? fullscreen.toggle : undefined,
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
    pushToTalk: canPublish
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

  const badges = {
    chat: unreadChat || undefined,
    qna: newQuestions || undefined,
    polls: !isHost && openPolls ? ("dot" as const) : undefined,
    people: isHost ? state.handRaises.length + speakRequests.length || undefined : undefined,
  };

  return (
    <div ref={rootRef} className="dark flex h-dvh overflow-hidden bg-stage text-foreground">
      {/* Stage column; on phones the panel nav sits under the stage */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1">
          <Stage
            isHost={isHost}
            isPanelist={isPanelist}
            myUserId={state.me?.userId ?? null}
            panelists={panelists}
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
            <StatusPill status={effectiveStatus} startedAt={startedAt} isHost={isHost} isPanelist={isPanelist} practice={practice} />
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
              {fullscreen.supported && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-white hover:bg-white/10 hover:text-white"
                  onClick={fullscreen.toggle}
                  aria-label={fullscreen.active ? "Exit fullscreen" : "Fullscreen"}
                  title={fullscreen.active ? "Exit fullscreen (F)" : "Fullscreen (F)"}
                >
                  {fullscreen.active ? <Minimize /> : <Maximize />}
                </Button>
              )}
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
              canPublish={canPublish}
              status={effectiveStatus}
              practice={practice}
              practiceBusy={busy === "practice"}
              onTogglePractice={() => void togglePractice()}
              speakRequested={mySpeakRequest}
              onToggleSpeak={() => void toggleSpeak()}
              media={media}
              micLevel={micLevel}
              handRaised={myHandRaised}
              handRaiseEnabled={state.settings?.handRaiseEnabled ?? true}
              reactionsEnabled={state.settings?.reactionsEnabled ?? true}
              panel={panel}
              badges={badges}
              recorder={recorder}
              volume={broadcast.volume}
              onVolume={broadcast.setVolume}
              onPanel={togglePanel}
              onReact={(e) => void react(e)}
              onToggleHand={() => void toggleHand()}
              onToggleRecord={toggleRecord}
              onSettings={() => setSettingsOpen(true)}
              onShortcuts={() => setShortcutsOpen(true)}
              onGoLive={() => setConfirmStart(true)}
              onEnd={() => setConfirmEnd(true)}
              onLeave={leave}
              goingLive={busy === "live"}
            />
          </div>
        </div>
        <MobilePanelNav panel={panel} badges={badges} onPanel={togglePanel} />
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
            className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 flex h-[65dvh] flex-col rounded-t-3xl border-t bg-card shadow-2xl sm:bottom-0 sm:h-[70dvh] lg:static lg:z-auto lg:h-auto lg:w-[380px] lg:rounded-none lg:border-t-0 lg:border-l lg:shadow-none"
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
              {panel === "people" && (
                <PeoplePanel members={state.members} handRaises={state.handRaises} speakRequests={speakRequests} me={state.me} actions={actions} />
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {isHost && <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={state.settings} actions={actions} />}
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} isHost={isHost} canPublish={canPublish} />
      {isHost && <UpgradeDialog reason={upgradeReason} onOpenChange={(open) => !open && setUpgradeReason(null)} />}

      <AlertDialog open={confirmStart} onOpenChange={setConfirmStart}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Go live now?</AlertDialogTitle>
            <AlertDialogDescription>
              Everyone in the waiting room will see and hear you
              {panelists.length > 0 && ` and your ${panelists.length === 1 ? "panelist" : `${panelists.length} panelists`}`}, and
              registrants get a &quot;we&apos;re live&quot; email.
              {practice && " Practice ends when you go live."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "live"}>Not yet</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy === "live"}
              className="bg-live text-white hover:bg-live/90"
              onClick={(e) => {
                e.preventDefault();
                void lifecycle("start");
              }}
            >
              Go live
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

function StatusPill({
  status,
  startedAt,
  isHost,
  isPanelist,
  practice,
}: {
  status: WebinarStatus;
  startedAt: string | null;
  isHost: boolean;
  isPanelist: boolean;
  practice: boolean;
}) {
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
  if (practice && (isHost || isPanelist)) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-highlight/90 px-2.5 py-1 text-[11px] font-semibold text-black">
        PRACTICE <span className="hidden font-normal sm:inline">· attendees can&apos;t see you</span>
      </span>
    );
  }
  if (isPanelist) {
    return <span className="inline-flex shrink-0 items-center rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/80">Backstage · not live yet</span>;
  }
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
