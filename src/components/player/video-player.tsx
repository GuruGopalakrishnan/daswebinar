"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatClock } from "@/lib/format";
import { useMounted } from "@/hooks/use-client-values";
import { cn } from "@/lib/utils";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function readResume(key: string) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}
function writeResume(key: string, value: number) {
  try {
    if (value > 0) localStorage.setItem(key, String(Math.floor(value)));
    else localStorage.removeItem(key);
  } catch {
    // Storage unavailable (private mode); resume is a nicety.
  }
}

export function VideoPlayer({ src, title, resumeKey }: { src: string; title: string; resumeKey: string }) {
  const container = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [waiting, setWaiting] = useState(true);
  const [error, setError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null);
  const [flash, setFlash] = useState<{ id: number; icon: "play" | "pause" | "back" | "fwd" } | null>(null);

  const mounted = useMounted();
  const v = () => video.current;

  const poke = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (video.current && !video.current.paused) setShowControls(false);
    }, 2500);
  }, []);

  const toggle = useCallback(() => {
    const el = v();
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
    setFlash({ id: Date.now(), icon: el.paused ? "pause" : "play" });
  }, []);

  const seekBy = useCallback((delta: number) => {
    const el = v();
    if (!el) return;
    el.currentTime = Math.min(Math.max(0, el.currentTime + delta), el.duration || Infinity);
    setFlash({ id: Date.now(), icon: delta < 0 ? "back" : "fwd" });
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void container.current?.requestFullscreen();
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.target instanceof HTMLInputElement && e.target.type !== "range") return;
    const el = v();
    if (!el) return;
    const keys: Record<string, () => void> = {
      " ": toggle,
      k: toggle,
      j: () => seekBy(-10),
      l: () => seekBy(10),
      ArrowLeft: () => seekBy(-5),
      ArrowRight: () => seekBy(5),
      m: () => (el.muted = !el.muted),
      f: toggleFullscreen,
    };
    const action = keys[e.key];
    if (action && !(e.target instanceof HTMLInputElement && e.key.startsWith("Arrow"))) {
      e.preventDefault();
      action();
      poke();
    }
  }

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const progress = duration ? (time / duration) * 100 : 0;

  return (
    <div
      ref={container}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseMove={poke}
      onMouseLeave={() => playing && setShowControls(false)}
      className={cn(
        "group relative aspect-video w-full overflow-hidden rounded-2xl bg-black outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !showControls && playing && "cursor-none",
      )}
      aria-label={`Video player: ${title}. Space to play or pause, J and L to skip 10 seconds, F for fullscreen.`}
    >
      <video
        ref={video}
        src={src}
        playsInline
        preload="metadata"
        className="size-full"
        onClick={toggle}
        onDoubleClick={toggleFullscreen}
        onPlay={() => {
          setPlaying(true);
          poke();
        }}
        onPause={() => {
          setPlaying(false);
          setShowControls(true);
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          setDuration(el.duration);
          const resume = readResume(resumeKey);
          if (resume > 5 && resume < el.duration - 10) el.currentTime = resume;
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          setTime(el.currentTime);
          if (el.buffered.length) setBuffered(el.buffered.end(el.buffered.length - 1));
          if (Math.floor(el.currentTime) % 5 === 0) writeResume(resumeKey, el.currentTime);
        }}
        onEnded={() => writeResume(resumeKey, 0)}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
        onError={() => {
          setError(true);
          setWaiting(false);
        }}
      />

      {/* Center states */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {error ? (
          <div className="flex flex-col items-center gap-2 text-center text-white">
            <AlertTriangle className="size-8 text-warning" />
            <p className="font-medium">This video can&apos;t be played</p>
            <p className="text-sm text-white/60">The file may have moved or isn&apos;t a supported format.</p>
          </div>
        ) : waiting && playing ? (
          <Loader2 className="size-10 animate-spin text-white/80" />
        ) : !playing ? (
          <button
            onClick={toggle}
            aria-label="Play"
            className="pointer-events-auto flex size-16 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition-transform hover:scale-105"
          >
            <Play className="size-7 translate-x-0.5 fill-current" />
          </button>
        ) : null}
        <AnimatePresence>
          {flash && playing && (
            <motion.span
              key={flash.id}
              initial={{ opacity: 0.9, scale: 0.8 }}
              animate={{ opacity: 0, scale: 1.3 }}
              transition={{ duration: 0.5 }}
              className="absolute flex size-14 items-center justify-center rounded-full bg-black/50 text-white"
            >
              {flash.icon === "back" ? <RotateCcw /> : flash.icon === "fwd" ? <RotateCw /> : flash.icon === "pause" ? <Pause /> : <Play />}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <motion.div
        initial={false}
        animate={{ opacity: showControls || !playing ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pt-12 pb-2 text-white sm:px-4"
      >
        {/* Seek bar */}
        <div
          className="group/seek relative h-4 cursor-pointer"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
            setHover({ x: ratio * r.width, t: ratio * duration });
          }}
          onMouseLeave={() => setHover(null)}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/25 transition-[height] group-hover/seek:h-1.5">
            <div className="absolute inset-y-0 left-0 bg-white/35" style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }} />
            <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-white shadow transition-transform group-hover/seek:scale-100"
            style={{ left: `${progress}%` }}
          />
          {hover && duration > 0 && (
            <span
              className="absolute -top-7 -translate-x-1/2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[11px]"
              style={{ left: hover.x }}
            >
              {formatClock(hover.t)}
            </span>
          )}
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            onChange={(e) => {
              const el = v();
              if (el) el.currentTime = Number(e.target.value);
            }}
            aria-label="Seek"
            aria-valuetext={`${formatClock(time)} of ${formatClock(duration)}`}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </div>

        <div className="mt-1 flex items-center gap-1 sm:gap-2">
          <IconButton label={playing ? "Pause (k)" : "Play (k)"} onClick={toggle}>
            {playing ? <Pause className="fill-current" /> : <Play className="fill-current" />}
          </IconButton>
          <IconButton label="Back 10 seconds (j)" onClick={() => seekBy(-10)}>
            <RotateCcw />
          </IconButton>
          <IconButton label="Forward 10 seconds (l)" onClick={() => seekBy(10)}>
            <RotateCw />
          </IconButton>

          <div className="group/vol flex items-center">
            <IconButton
              label={muted ? "Unmute (m)" : "Mute (m)"}
              onClick={() => {
                const el = v();
                if (el) el.muted = !el.muted;
              }}
            >
              <VolumeIcon />
            </IconButton>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const el = v();
                if (!el) return;
                el.volume = Number(e.target.value);
                el.muted = el.volume === 0;
              }}
              aria-label="Volume"
              className="hidden w-0 accent-white transition-all group-hover/vol:w-20 focus:w-20 sm:block"
            />
          </div>

          <span className="ml-1 font-mono text-xs text-white/85 tabular-nums">
            {formatClock(time)} <span className="text-white/50">/ {formatClock(duration)}</span>
          </span>

          <div className="ml-auto flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-md px-2 py-1 text-xs font-medium tabular-nums hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none" aria-label="Playback speed">
                {speed}×
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-28">
                <DropdownMenuRadioGroup
                  value={String(speed)}
                  onValueChange={(value) => {
                    const s = Number(value);
                    setSpeed(s);
                    const el = v();
                    if (el) el.playbackRate = s;
                  }}
                >
                  {SPEEDS.map((s) => (
                    <DropdownMenuRadioItem key={s} value={String(s)}>
                      {s === 1 ? "Normal" : `${s}×`}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {mounted && document.pictureInPictureEnabled && (
              <IconButton
                label="Picture in picture"
                onClick={() => {
                  const el = v();
                  if (!el) return;
                  if (document.pictureInPictureElement) void document.exitPictureInPicture();
                  else void el.requestPictureInPicture().catch(() => {});
                }}
                className="hidden sm:flex"
              >
                <PictureInPicture2 />
              </IconButton>
            )}
            <IconButton label={fullscreen ? "Exit fullscreen (f)" : "Fullscreen (f)"} onClick={toggleFullscreen}>
              {fullscreen ? <Minimize /> : <Maximize />}
            </IconButton>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-9 items-center justify-center rounded-md transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none [&_svg]:size-5",
        className,
      )}
    >
      {children}
    </button>
  );
}
