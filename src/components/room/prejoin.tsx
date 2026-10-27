"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Check, Loader2, Mic, MicOff, Volume2 } from "lucide-react";
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
    <label className="grid gap-1.5 text-xs text-white/60">
      {label}
      <Select value={value ?? undefined} onValueChange={onChange}>
        <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
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
    <div className="dark flex min-h-dvh items-center justify-center bg-stage p-4 text-white">
      <div className="grid w-full max-w-4xl gap-6 md:grid-cols-[1.4fr_1fr] md:items-center">
        <div className="relative aspect-video overflow-hidden rounded-3xl bg-black/40 ring-1 ring-white/10">
          {isHost && media.camera ? (
            <video ref={preview} autoPlay playsInline muted className="size-full -scale-x-100 object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-3">
              <UserAvatar name={name} className="size-20 text-xl" />
              {isHost && <p className="text-sm text-white/50">{media.busy === "camera" ? "Starting camera…" : "Camera is off"}</p>}
            </div>
          )}

          {isHost && (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 p-4">
              <button
                type="button"
                onClick={() => void media.toggleMic()}
                aria-label={media.micOn ? "Mute microphone" : "Unmute microphone"}
                className={cn(
                  "relative flex size-12 items-center justify-center rounded-full transition-colors",
                  media.micOn ? "bg-white/15 hover:bg-white/25" : "bg-destructive hover:bg-destructive/90",
                )}
              >
                {media.micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
              </button>
              <button
                type="button"
                onClick={() => void media.toggleCamera()}
                aria-label={media.camera ? "Turn camera off" : "Turn camera on"}
                className={cn(
                  "flex size-12 items-center justify-center rounded-full transition-colors",
                  media.camera ? "bg-white/15 hover:bg-white/25" : "bg-destructive hover:bg-destructive/90",
                )}
              >
                {media.camera ? <Camera className="size-5" /> : <CameraOff className="size-5" />}
              </button>
            </div>
          )}
        </div>

        <div className="grid gap-5">
          <div>
            <p className="text-xs font-medium tracking-wider text-white/50 uppercase">{isHost ? "Get ready" : "You're about to join"}</p>
            <h1 className="mt-1 font-display text-3xl leading-tight text-balance">{title}</h1>
          </div>

          {errorText && <p className="rounded-xl bg-destructive/15 p-3 text-sm text-red-200">{errorText}</p>}

          {isHost && (
            <>
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>Microphone</span>
                  <span>{media.micOn ? (level > 0.08 ? "We hear you" : "Say something…") : "Muted"}</span>
                </div>
                <div className="flex h-2 gap-1" aria-hidden>
                  {Array.from({ length: 16 }, (_, i) => (
                    <span
                      key={i}
                      className={cn("flex-1 rounded-full transition-colors duration-75", media.micOn && level * 16 > i ? "bg-primary" : "bg-white/10")}
                    />
                  ))}
                </div>
              </div>
              <DeviceSelect label="Camera" devices={media.devices.cameras} value={media.cameraId} onChange={(id) => void media.selectDevice("camera", id)} />
              <DeviceSelect label="Microphone" devices={media.devices.mics} value={media.micId} onChange={(id) => void media.selectDevice("mic", id)} />
            </>
          )}

          <DeviceSelect label="Speaker" devices={media.devices.speakers} value={media.speakerId} onChange={(id) => void media.selectDevice("speaker", id)} />

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/15 bg-white/5 text-white hover:bg-white/10"
              onClick={() => void speaker.play()}
              disabled={speaker.playing}
            >
              <Volume2 /> {speaker.playing ? "Playing…" : "Test speakers"}
            </Button>
            {!speaker.heard && !speaker.playing && (
              <button type="button" className="text-xs text-white/50 underline-offset-2 hover:underline" onClick={() => speaker.setHeard(true)}>
                I heard it
              </button>
            )}
            {speaker.heard && (
              <span className="inline-flex items-center gap-1 text-xs text-primary">
                <Check className="size-3.5" /> Sound works
              </span>
            )}
          </div>

          <Button size="lg" className="h-12 rounded-full text-base" onClick={onJoin} disabled={media.busy !== null}>
            {media.busy !== null && <Loader2 className="animate-spin" />}
            {isHost ? "Enter studio" : "Join webinar"}
          </Button>
          {isHost && <p className="text-xs text-white/50">Attendees can&apos;t see or hear you until you press Go live.</p>}
        </div>
      </div>
    </div>
  );
}
