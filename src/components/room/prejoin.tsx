"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Check, Mic, MicOff, Volume2 } from "lucide-react";
import { Ticks } from "@/components/blocks/lists";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import type { LocalMedia } from "./use-local-media";
import { useAudioLevel } from "./use-local-media";

/** A short two-note chime as a WAV blob, so it can be routed to a chosen speaker. */
function chimeUrl() {
  const rate = 22050;
  const seconds = 0.7;
  const n = Math.floor(rate * seconds);
  const buffer = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const f = t < 0.3 ? 660 : 880;
    const env = Math.min(1, t * 40) * Math.exp(-4 * (t % 0.35));
    v.setInt16(44 + i * 2, Math.sin(2 * Math.PI * f * t) * env * 0.4 * 32767, true);
  }
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

function useSpeakerTest(speakerId: string | null) {
  const [playing, setPlaying] = useState(false);
  const [heard, setHeard] = useState(false);
  async function play() {
    const url = chimeUrl();
    const audio = new Audio(url);
    const withSink = audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
    if (speakerId && withSink.setSinkId) await withSink.setSinkId(speakerId).catch(() => {});
    setPlaying(true);
    audio.onended = () => {
      setPlaying(false);
      URL.revokeObjectURL(url);
    };
    await audio.play().catch(() => setPlaying(false));
  }
  return { playing, heard, setHeard, play };
}

function DeviceSelect({
  label,
  devices,
  value,
  onChange,
}: {
  label: string;
  devices: MediaDeviceInfo[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  if (devices.length === 0) return null;
  return (
    <label className="grid gap-1.5 text-xs text-muted-foreground">
      {label}
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="System default" />
        </SelectTrigger>
        <SelectContent>
          {devices.map((d, i) => (
            <SelectItem key={d.deviceId} value={d.deviceId}>
              {d.label || `${label} ${i + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

export function PreJoin({
  isHost,
  title,
  name,
  media,
  onJoin,
}: {
  isHost: boolean;
  title: string;
  name: string;
  media: LocalMedia;
  onJoin: () => void;
}) {
  const preview = useRef<HTMLVideoElement>(null);
  const level = useAudioLevel(media.mic);
  const speaker = useSpeakerTest(media.speakerId);

  // Hosts: open camera and mic straight away so they can check both.
  useEffect(() => {
    if (!isHost) return;
    void media.startCamera();
    void media.startMic(false);
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost]);

  useEffect(() => {
    if (preview.current) preview.current.srcObject = media.camera;
  }, [media.camera]);

  const errorText =
    media.error === "denied"
      ? "Camera or mic access is blocked. Click the lock icon in the address bar and allow them, then try again."
      : media.error === "in_use"
        ? "Another app is using your camera or mic. Close it (Zoom, Teams, Meet) and try again."
        : media.error === "unavailable"
          ? "We couldn't find a camera or microphone."
          : null;

  return (
    <div className="dark flex min-h-dvh items-center justify-center bg-background p-4 text-foreground">
      <div className="grid w-full max-w-4xl grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-center">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-stage shadow-[0_0_0_1px_oklch(1_0_0/0.04),0_12px_32px_-16px_rgb(0_0_0/0.5)]">
          {isHost && media.camera ? (
            <video ref={preview} autoPlay playsInline muted className="size-full -scale-x-100 object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-3">
              <UserAvatar name={name} className="size-20 text-xl" />
              {isHost && <p className="text-sm text-muted-foreground">{media.busy === "camera" ? "Starting camera…" : "Camera is off"}</p>}
            </div>
          )}

          {isHost && (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 p-4">
              <DockButton on={media.micOn} onClick={() => void media.toggleMic()} label={media.micOn ? "Mute microphone" : "Unmute microphone"}>
                {media.micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
              </DockButton>
              <DockButton on={media.camera !== null} onClick={() => void media.toggleCamera()} label={media.camera ? "Turn camera off" : "Turn camera on"}>
                {media.camera ? <Camera className="size-5" /> : <CameraOff className="size-5" />}
              </DockButton>
            </div>
          )}
        </div>

        <div className="grid gap-5">
          <div className="grid gap-1">
            <p className="eyebrow">{isHost ? "Get ready" : "You're about to join"}</p>
            <h1 className="t-h2">{title}</h1>
          </div>

          {errorText && (
            <p role="alert" className="rounded-md border border-[color-mix(in_oklch,var(--destructive)_30%,transparent)] bg-destructive-subtle px-4 py-3 text-sm">
              {errorText}
            </p>
          )}

          {isHost ? (
            <>
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Microphone</span>
                  <span aria-live="polite">{media.micOn ? (level > 0.08 ? "We hear you" : "Say something…") : "Muted"}</span>
                </div>
                <div className="flex h-2 gap-1" aria-hidden>
                  {Array.from({ length: 16 }, (_, i) => (
                    <span key={i} className={cn("flex-1 rounded-full transition-colors duration-75", media.micOn && level * 16 > i ? "bg-teal" : "bg-muted")} />
                  ))}
                </div>
              </div>
              <DeviceSelect label="Camera" devices={media.devices.cameras} value={media.cameraId} onChange={(id) => void media.selectDevice("camera", id)} />
              <DeviceSelect label="Microphone" devices={media.devices.mics} value={media.micId} onChange={(id) => void media.selectDevice("mic", id)} />
            </>
          ) : (
            <div className="grid gap-2">
              <p className="text-sm font-semibold">Before you join</p>
              <Ticks
                className="text-sm text-muted-foreground"
                items={[
                  "Use Chrome, Edge, Safari or Firefox",
                  "Headphones give the best sound",
                  "You watch and listen; use chat and Q&A to take part",
                  "On a phone? Turn it sideways for a bigger view",
                ]}
              />
            </div>
          )}

          <DeviceSelect label="Speaker" devices={media.devices.speakers} value={media.speakerId} onChange={(id) => void media.selectDevice("speaker", id)} />

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void speaker.play()} disabled={speaker.playing}>
              <Volume2 /> {speaker.playing ? "Playing…" : "Test my speakers"}
            </Button>
            {!speaker.heard && !speaker.playing && (
              <button type="button" className="cursor-pointer text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => speaker.setHeard(true)}>
                I heard it
              </button>
            )}
            {speaker.heard && (
              <span className="inline-flex items-center gap-1 text-xs text-teal">
                <Check className="size-3.5" /> Sound works
              </span>
            )}
          </div>

          <Button size="lg" className="w-full" onClick={onJoin} loading={media.busy !== null}>
            {isHost ? "Enter studio" : "Join webinar"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {isHost
              ? "Attendees can't see or hear you until you press Go live."
              : "If the host hasn't started yet, you'll wait in the room until they do."}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Round mic/camera toggle on the preview (44 px target; red when off). */
function DockButton({ on, onClick, label, children }: { on: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      className={cn(
        "flex size-11 cursor-pointer items-center justify-center rounded-xl transition-[background-color,transform] duration-[180ms] active:scale-[0.94] focus-visible:outline-2 focus-visible:outline-ring",
        on ? "bg-card text-foreground hover:bg-accent" : "bg-destructive text-white hover:bg-destructive/90",
      )}
    >
      {children}
    </button>
  );
}
