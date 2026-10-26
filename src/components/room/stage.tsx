"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Info, MicOff, MonitorUp, Radio } from "lucide-react";
import { Countdown } from "@/components/countdown";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import type { WebinarStatus } from "@/lib/webinars/types";
import type { ReactionBurst } from "./use-room";

function VideoView({ stream, mirrored, className }: { stream: MediaStream; mirrored?: boolean; className?: string }) {
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
      className={cn("size-full object-cover", mirrored && "-scale-x-100", className)}
    />
  );
}

type Props = {
  isHost: boolean;
  status: WebinarStatus;
  hostName: string;
  startsAt: string;
  camera: MediaStream | null;
  screen: MediaStream | null;
  micOn: boolean;
  micLevel: number;
  bursts: ReactionBurst[];
  onBurstDone: (id: number) => void;
};

export function Stage({ isHost, status, hostName, startsAt, camera, screen, micOn, micLevel, bursts, onBurstDone }: Props) {
  return (
    <div className="relative isolate flex size-full min-h-0 items-center justify-center overflow-hidden rounded-2xl bg-stage ring-1 ring-white/5">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_30%_10%,oklch(0.66_0.19_280/0.22),transparent_55%),radial-gradient(ellipse_at_85%_95%,oklch(0.7_0.16_320/0.15),transparent_50%)]" />

      {isHost ? (
        screen ? (
          <>
            <VideoView stream={screen} className="object-contain" />
            {camera && (
              <motion.div
                drag
                dragMomentum={false}
                className="absolute right-4 bottom-4 aspect-video w-40 cursor-grab overflow-hidden rounded-xl shadow-2xl ring-2 ring-white/20 active:cursor-grabbing sm:w-56"
              >
                <VideoView stream={camera} mirrored />
              </motion.div>
            )}
          </>
        ) : camera ? (
          <VideoView stream={camera} mirrored />
        ) : (
          <SpeakerTile name={hostName} level={micOn ? micLevel : 0} caption="Your camera is off" />
        )
      ) : (
        <AttendeeView status={status} hostName={hostName} startsAt={startsAt} />
      )}

      {/* Overlays */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-black/45 px-2.5 py-1 text-xs text-white/90 backdrop-blur">
            {hostName}
            {isHost && " (you)"}
          </span>
          {isHost && !micOn && (
            <span className="flex size-6 items-center justify-center rounded-full bg-black/45 text-white/90 backdrop-blur" aria-label="Microphone off">
              <MicOff className="size-3.5" />
            </span>
          )}
          {screen && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/80 px-2.5 py-1 text-xs text-white backdrop-blur">
              <MonitorUp className="size-3.5" /> Presenting
            </span>
          )}
        </div>
        {isHost && (camera || screen) && (
          <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur" title="Video broadcast to attendees isn't enabled in this build">
            <Info className="size-3" /> Local preview
          </span>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 overflow-hidden" aria-hidden>
        <AnimatePresence>
          {bursts.map((b) => (
            <motion.span
              key={b.id}
              initial={{ y: 30, opacity: 0, scale: 0.5, x: 0 }}
              animate={{ y: -320, opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1], x: [0, (b.id % 2 ? 1 : -1) * 18, 0] }}
              transition={{ duration: 3, ease: "easeOut" }}
              onAnimationComplete={() => onBurstDone(b.id)}
              className="absolute bottom-0 text-3xl drop-shadow-lg"
              style={{ right: `${8 + ((b.id * 13) % 22)}%` }}
            >
              {b.emoji}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SpeakerTile({ name, level, caption }: { name: string; level: number; caption?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="relative">
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full bg-primary/40"
          animate={{ scale: 1 + level * 0.45, opacity: 0.25 + level * 0.6 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        />
        <UserAvatar name={name} className="relative size-24 text-2xl sm:size-28" />
      </div>
      {caption && <p className="text-sm text-white/60">{caption}</p>}
    </div>
  );
}

function AttendeeView({ status, hostName, startsAt }: { status: WebinarStatus; hostName: string; startsAt: string }) {
  if (status === "live") {
    return (
      <div className="flex max-w-sm flex-col items-center gap-4 px-6 text-center">
        <div className="relative">
          <span className="absolute -inset-3 animate-ping rounded-full bg-live/20" />
          <UserAvatar name={hostName} className="relative size-24 text-2xl" />
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-live px-3 py-1 text-xs font-semibold text-white">
          <Radio className="size-3.5" /> {hostName} is live
        </span>
        <p className="text-sm text-white/60">
          Video broadcast isn&apos;t enabled for this webinar yet. Follow along in chat, Q&amp;A and polls.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-5 px-6 text-center text-white">
      <UserAvatar name={hostName} className="size-20 text-xl" />
      <div>
        <p className="text-lg font-semibold">Starting soon</p>
        <p className="mt-1 text-sm text-white/60">You&apos;re in the waiting room. {hostName} will start the session shortly.</p>
      </div>
      <div className="[&_div]:border-white/10 [&_div]:bg-white/5 [&_div]:text-white">
        <Countdown to={startsAt} />
      </div>
    </div>
  );
}
