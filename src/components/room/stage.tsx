"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import type { IRemoteVideoTrack } from "agora-rtc-sdk-ng";
import { MessageCircleQuestion, MicOff, Volume2 } from "lucide-react";
import { Countdown } from "@/components/countdown";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import type { Participant, Question } from "@/lib/realtime/protocol";
import type { WebinarStatus } from "@/lib/webinars/types";
import type { Broadcast } from "./use-broadcast";
import type { ReactionBurst } from "./use-room";

/** A local MediaStream (host self-view) or a remote Agora track (attendees). */
type Surface = { kind: "stream"; stream: MediaStream; mirrored?: boolean } | { kind: "track"; track: IRemoteVideoTrack };

function StreamView({ stream, mirrored, fit }: { stream: MediaStream; mirrored?: boolean; fit: "contain" | "cover" }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={cn("size-full", fit === "contain" ? "object-contain" : "object-cover", mirrored && "-scale-x-100")}
    />
  );
}

/** Played by the Agora SDK into its own <video>. */
function TrackView({ track, fit }: { track: IRemoteVideoTrack; fit: "contain" | "cover" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    track.play(ref.current, { fit });
    return () => track.stop();
  }, [track, fit]);
  return <div ref={ref} className="size-full" />;
}

function SurfaceView({ surface, fit }: { surface: Surface; fit: "contain" | "cover" }) {
  return surface.kind === "stream" ? (
    <StreamView stream={surface.stream} mirrored={surface.mirrored} fit={fit} />
  ) : (
    <TrackView track={surface.track} fit={fit} />
  );
}

/** Someone on stage: the host or a panelist, seen locally (me) or remotely. */
type Tile = {
  key: string;
  name: string;
  role: "host" | "panelist";
  me: boolean;
  surface: Surface | null;
  micOn: boolean;
  level: number;
};

type Props = {
  isHost: boolean;
  /** I am a panelist (on stage, not the host). */
  isPanelist: boolean;
  myUserId: string | null;
  /** Panelists on stage, from the room state. */
  panelists: Participant[];
  status: WebinarStatus;
  hostName: string;
  startsAt: string;
  /** Host self-view. */
  camera: MediaStream | null;
  screen: MediaStream | null;
  micOn: boolean;
  micLevel: number;
  broadcast: Broadcast;
  bursts: ReactionBurst[];
  onBurstDone: (id: number) => void;
  spotlight: Question | null;
  /** Floating cards (e.g. a poll) rendered over the stage. */
  children?: React.ReactNode;
};

export function Stage({
  isHost,
  isPanelist,
  myUserId,
  panelists,
  status,
  hostName,
  startsAt,
  camera,
  screen,
  micOn,
  micLevel,
  broadcast,
  bursts,
  onBurstDone,
  spotlight,
  children,
}: Props) {
  const self = (name: string, role: Tile["role"]): Tile => ({
    key: "me",
    name,
    role,
    me: true,
    surface: camera ? { kind: "stream", stream: camera, mirrored: true } : null,
    micOn,
    level: micOn ? micLevel : 0,
  });
  const remote = (key: string, name: string, role: Tile["role"], uid: number | null): Tile => {
    const feed = uid === null ? undefined : broadcast.feeds[uid];
    return {
      key,
      name,
      role,
      me: false,
      surface: feed?.video ? { kind: "track", track: feed.video } : null,
      micOn: Boolean(feed?.audio),
      level: feed?.level ?? 0,
    };
  };
  const tiles: Tile[] = [
    isHost ? self(hostName, "host") : remote("host", hostName, "host", broadcast.hostUid),
    ...panelists.map((p) => (p.userId === myUserId ? self(p.name, "panelist") : remote(p.userId, p.name, "panelist", p.rtcUid))),
  ];
  // Attendees only see the stage once it's live (practice is private).
  const gallery = tiles.length > 1 && (isHost || isPanelist || status === "live");

  const main: Surface | null = isHost
    ? screen
      ? { kind: "stream", stream: screen }
      : camera
        ? { kind: "stream", stream: camera, mirrored: true }
        : null
    : broadcast.screenVideo
      ? { kind: "track", track: broadcast.screenVideo }
      : broadcast.hostVideo
        ? { kind: "track", track: broadcast.hostVideo }
        : null;
  const presenting = isHost ? Boolean(screen) : Boolean(broadcast.screenVideo);
  const pip: Surface | null = !presenting || gallery
    ? null
    : isHost
      ? camera && { kind: "stream", stream: camera, mirrored: true }
      : broadcast.hostVideo && { kind: "track", track: broadcast.hostVideo };
  const speaking = isHost ? micOn && micLevel > 0.15 : broadcast.hostAudio;
  const hostMuted = isHost ? !micOn : status === "live" && broadcast.state === "connected" && !broadcast.hostAudio;

  return (
    <div className="relative isolate flex size-full items-center justify-center overflow-hidden bg-stage">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_15%_0%,oklch(0.42_0.06_180/0.35),transparent_55%),radial-gradient(ellipse_at_100%_100%,oklch(0.5_0.08_78/0.18),transparent_50%)]"
      />

      {gallery && !presenting ? (
        <Gallery tiles={tiles} />
      ) : main ? (
        <SurfaceView key={main.kind === "stream" ? main.stream.id : main.track.getTrackId()} surface={main} fit={presenting ? "contain" : "cover"} />
      ) : !isHost && status !== "live" ? (
        <WaitingRoom hostName={hostName} startsAt={startsAt} />
      ) : (
        <SpeakerTile
          name={hostName}
          level={isHost ? (micOn ? micLevel : 0) : broadcast.hostAudio ? 0.5 : 0}
          caption={stageCaption(isHost, status, hostName, broadcast)}
        />
      )}

      {pip && (
        <motion.div
          drag
          dragMomentum={false}
          dragConstraints={{ left: -2000, right: 0, top: -2000, bottom: 0 }}
          className={cn(
            "absolute right-4 bottom-24 aspect-video w-36 cursor-grab overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/15 active:cursor-grabbing sm:w-60",
            speaking && "ring-2 ring-primary",
          )}
          title="Drag to move"
        >
          <SurfaceView surface={pip} fit="cover" />
          <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white">
            {hostMuted && <MicOff className="size-3" />} {hostName}
          </span>
        </motion.div>
      )}

      {gallery && presenting && <Filmstrip tiles={tiles} />}

      {/* Name tag on a full-frame camera */}
      {main && !presenting && !gallery && (
        <span className="absolute bottom-24 left-4 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs text-white backdrop-blur">
          {hostMuted ? <MicOff className="size-3.5" /> : <SpeakingBars active={speaking} />}
          {hostName}
          {isHost && " (you)"}
        </span>
      )}

      {!isHost && broadcast.audioBlocked && (
        <button
          type="button"
          onClick={broadcast.unblockAudio}
          className="absolute top-1/2 left-1/2 z-20 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black shadow-2xl"
        >
          <Volume2 className="size-4" /> Tap to turn on sound
        </button>
      )}

      {spotlight && (
        <motion.div
          key={spotlight.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass absolute bottom-24 left-1/2 z-10 w-[min(92%,640px)] -translate-x-1/2 rounded-2xl p-4 text-white shadow-2xl"
        >
          <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-highlight uppercase">
            <MessageCircleQuestion className="size-3.5" /> Question from {spotlight.author.name}
          </p>
          <p className="mt-1.5 text-base text-pretty sm:text-lg">{spotlight.text}</p>
        </motion.div>
      )}

      {children}

      <div className="pointer-events-none absolute right-6 bottom-20 h-2/3 w-24 overflow-hidden" aria-hidden>
        {bursts.map((b) => (
          <span
            key={b.id}
            onAnimationEnd={() => onBurstDone(b.id)}
            className="absolute bottom-0 animate-[float-up_2.8s_ease-out_forwards] text-3xl drop-shadow-lg"
            style={{ left: `${(b.id * 17) % 60}px` }}
          >
            {b.emoji}
          </span>
        ))}
      </div>
    </div>
  );
}

function TileView({ tile, compact }: { tile: Tile; compact?: boolean }) {
  const speaking = tile.micOn && tile.level > 0.15;
  return (
    <div
      className={cn(
        "relative flex size-full items-center justify-center overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/10 transition-shadow",
        speaking && "ring-2 ring-primary",
      )}
    >
      {tile.surface ? (
        <SurfaceView surface={tile.surface} fit="cover" />
      ) : (
        <UserAvatar name={tile.name} className={compact ? "size-10 text-sm" : "size-16 text-lg sm:size-20"} />
      )}
      <span className="absolute bottom-1.5 left-1.5 inline-flex max-w-[calc(100%-0.75rem)] items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white backdrop-blur">
        {tile.micOn ? <SpeakingBars active={speaking} /> : <MicOff className="size-3 shrink-0" />}
        <span className="truncate">
          {tile.name}
          {tile.me && " (you)"}
        </span>
        {!compact && tile.role === "host" && <span className="ml-0.5 text-[10px] text-highlight uppercase">Host</span>}
      </span>
    </div>
  );
}

/** Host and panelists side by side. */
function Gallery({ tiles }: { tiles: Tile[] }) {
  const cols = tiles.length <= 4 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3";
  return (
    <div className={cn("grid size-full content-center gap-2 p-3 pt-16 pb-24 sm:gap-3 sm:p-6 sm:pt-20 sm:pb-28", cols)}>
      {tiles.map((t) => (
        <div key={t.key} className="aspect-video min-h-0 w-full">
          <TileView tile={t} />
        </div>
      ))}
    </div>
  );
}

/** Everyone on stage in a strip beside a screen share. */
function Filmstrip({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="absolute top-16 right-3 bottom-24 flex w-28 flex-col gap-2 overflow-y-auto scrollbar-thin sm:right-4 sm:w-44">
      {tiles.map((t) => (
        <div key={t.key} className="aspect-video w-full shrink-0">
          <TileView tile={t} compact />
        </div>
      ))}
    </div>
  );
}

function stageCaption(isHost: boolean, status: WebinarStatus, hostName: string, b: Broadcast) {
  if (isHost) return status === "live" ? "Your camera is off — attendees hear you only." : "Your camera is off.";
  if (b.state === "unavailable") return "Video isn't available for this webinar. Follow along in chat, Q&A and polls.";
  if (b.state === "error") return b.error ?? "Couldn't connect to the broadcast.";
  if (b.state !== "connected") return "Connecting to the broadcast…";
  return b.hostAudio ? `${hostName}'s camera is off.` : `Waiting for ${hostName} to turn on their camera or mic…`;
}

function SpeakingBars({ active }: { active: boolean }) {
  return (
    <span className="flex h-3 items-end gap-[2px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn("w-[3px] rounded-full bg-primary transition-all duration-150", active ? "animate-pulse" : "")}
          style={{ height: active ? `${[60, 100, 70][i]}%` : "30%", animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}

function SpeakerTile({ name, level, caption }: { name: string; level: number; caption?: string }) {
  return (
    <div className="flex max-w-sm flex-col items-center gap-5 px-6 text-center">
      <div className="relative">
        <motion.span
          aria-hidden
          className="absolute -inset-2 rounded-full bg-primary/40"
          animate={{ scale: 1 + level * 0.35, opacity: 0.15 + level * 0.6 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        />
        <UserAvatar name={name} className="relative size-24 text-2xl sm:size-28" />
      </div>
      {caption && <p className="text-sm text-white/60">{caption}</p>}
    </div>
  );
}

function WaitingRoom({ hostName, startsAt }: { hostName: string; startsAt: string }) {
  return (
    <div className="flex flex-col items-center gap-6 px-6 text-center text-white">
      <UserAvatar name={hostName} className="size-20 text-xl" />
      <div>
        <p className="font-display text-3xl">Starting soon</p>
        <p className="mt-1.5 text-sm text-white/60">You&apos;re in. {hostName} will start the session shortly — stay on this page.</p>
      </div>
      <div className="[&_div]:border-white/10 [&_div]:bg-white/5 [&_div]:text-white">
        <Countdown to={startsAt} />
      </div>
    </div>
  );
}
