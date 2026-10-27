"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type MediaError = "denied" | "unavailable" | "in_use" | null;

export type DeviceLists = { cameras: MediaDeviceInfo[]; mics: MediaDeviceInfo[]; speakers: MediaDeviceInfo[] };

const VIDEO: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } };
const AUDIO: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

function classify(e: unknown): MediaError {
  if (e instanceof DOMException) {
    if (e.name === "NotAllowedError" || e.name === "SecurityError") return "denied";
    if (e.name === "NotReadableError" || e.name === "AbortError") return "in_use";
  }
  return "unavailable";
}

const stop = (stream: MediaStream | null) => stream?.getTracks().forEach((t) => t.stop());

/**
 * Local camera, microphone and screen capture.
 *
 * - Camera off stops the track, so the camera light goes off.
 * - Mic mute keeps the track running and only flips `micMuted`: unmuting is
 *   instant (no new permission prompt or device warm-up), and the level meter
 *   keeps working so we can warn "you're talking while muted". The broadcast
 *   and the recorder both honour `micMuted`.
 * - Unplugging a device falls back to the system default.
 */
export function useLocalMedia() {
  const [camera, setCamera] = useState<MediaStream | null>(null);
  const [mic, setMic] = useState<MediaStream | null>(null);
  const [micMuted, setMicMuted] = useState(true);
  const [screen, setScreen] = useState<MediaStream | null>(null);
  const [error, setError] = useState<MediaError>(null);
  const [busy, setBusy] = useState<null | "camera" | "mic">(null);
  const [devices, setDevices] = useState<DeviceLists>({ cameras: [], mics: [], speakers: [] });
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [micId, setMicId] = useState<string | null>(null);
  const [speakerId, setSpeakerId] = useState<string | null>(null);

  // Latest values for event listeners and unmount cleanup.
  const live = useRef({ camera, mic, screen });
  useEffect(() => {
    live.current = { camera, mic, screen };
  }, [camera, mic, screen]);

  const refreshDevices = useCallback(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    void navigator.mediaDevices.enumerateDevices().then((all) =>
      setDevices({
        cameras: all.filter((d) => d.kind === "videoinput" && d.deviceId),
        mics: all.filter((d) => d.kind === "audioinput" && d.deviceId),
        speakers: all.filter((d) => d.kind === "audiooutput" && d.deviceId),
      }),
    );
  }, []);

  const acquire = useCallback(
    async (kind: "camera" | "mic", deviceId: string | null) => {
      setBusy(kind);
      setError(null);
      const base = kind === "camera" ? VIDEO : AUDIO;
      const constraints = deviceId ? { ...base, deviceId: { exact: deviceId } } : base;
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(kind === "camera" ? { video: constraints } : { audio: constraints });
        } catch (e) {
          // The chosen device vanished: fall back to the default one.
          if (!deviceId || !(e instanceof DOMException && e.name === "OverconstrainedError")) throw e;
          stream = await navigator.mediaDevices.getUserMedia(kind === "camera" ? { video: base } : { audio: base });
        }
        const track = kind === "camera" ? stream.getVideoTracks()[0] : stream.getAudioTracks()[0];
        // Device unplugged or taken by another app mid-session.
        track?.addEventListener("ended", () => {
          const current = kind === "camera" ? live.current.camera : live.current.mic;
          if (current !== stream) return;
          if (kind === "camera") setCamera(null);
          else setMic(null);
          setError("unavailable");
        });
        // Labels are only visible after permission is granted.
        refreshDevices();
        return stream;
      } catch (e) {
        setError(classify(e));
        return null;
      } finally {
        setBusy(null);
      }
    },
    [refreshDevices],
  );

  const startCamera = useCallback(async () => {
    if (live.current.camera) return true;
    const stream = await acquire("camera", cameraId);
    setCamera(stream);
    return stream !== null;
  }, [acquire, cameraId]);

  const stopCamera = useCallback(() => {
    stop(live.current.camera);
    setCamera(null);
  }, []);

  const toggleCamera = useCallback(async () => {
    if (live.current.camera) stopCamera();
    else await startCamera();
  }, [startCamera, stopCamera]);

  /** Opens the mic if needed; `muted` sets the initial state. */
  const startMic = useCallback(
    async (muted = false) => {
      if (!live.current.mic) {
        const stream = await acquire("mic", micId);
        if (!stream) return false;
        setMic(stream);
      }
      setMicMuted(muted);
      return true;
    },
    [acquire, micId],
  );

  const toggleMic = useCallback(async () => {
    if (!live.current.mic) {
      await startMic(false);
      return;
    }
    setMicMuted((m) => !m);
  }, [startMic]);

  const setMuted = useCallback((muted: boolean) => {
    if (live.current.mic) setMicMuted(muted);
  }, []);

  const toggleScreen = useCallback(async () => {
    if (live.current.screen) {
      stop(live.current.screen);
      setScreen(null);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        // Slides are mostly static text: favour sharpness over frame rate.
        video: { frameRate: { ideal: 15, max: 30 }, width: { max: 1920 }, height: { max: 1080 } },
        // Lets presenters share a tab's sound (videos in slides). Ignored where unsupported.
        audio: true,
      });
      const video = stream.getVideoTracks()[0];
      if (video && "contentHint" in video) video.contentHint = "detail";
      // The browser's own "Stop sharing" button ends the track.
      video?.addEventListener("ended", () => {
        if (live.current.screen === stream) {
          stop(stream);
          setScreen(null);
        }
      });
      setScreen(stream);
    } catch {
      // User cancelled the picker; nothing to do.
    }
  }, []);

  /** Switch camera or mic while keeping its on/off and mute state. */
  const selectDevice = useCallback(
    async (kind: "camera" | "mic" | "speaker", deviceId: string) => {
      if (kind === "speaker") {
        setSpeakerId(deviceId);
        return;
      }
      if (kind === "camera") {
        setCameraId(deviceId);
        if (!live.current.camera) return;
        const next = await acquire("camera", deviceId);
        if (next) {
          stop(live.current.camera);
          setCamera(next);
        }
      } else {
        setMicId(deviceId);
        if (!live.current.mic) return;
        const next = await acquire("mic", deviceId);
        if (next) {
          stop(live.current.mic);
          setMic(next);
        }
      }
    },
    [acquire],
  );

  /** Stop everything (leaving the room). */
  const release = useCallback(() => {
    const { camera: c, mic: m, screen: s } = live.current;
    [c, m, s].forEach(stop);
    setCamera(null);
    setMic(null);
    setScreen(null);
  }, []);

  useEffect(() => {
    const md = navigator.mediaDevices;
    if (!md?.enumerateDevices) return;
    void md.enumerateDevices().then((all) =>
      setDevices({
        cameras: all.filter((d) => d.kind === "videoinput" && d.deviceId),
        mics: all.filter((d) => d.kind === "audioinput" && d.deviceId),
        speakers: all.filter((d) => d.kind === "audiooutput" && d.deviceId),
      }),
    );
    md.addEventListener?.("devicechange", refreshDevices);
    return () => md.removeEventListener?.("devicechange", refreshDevices);
  }, [refreshDevices]);

  useEffect(
    () => () => {
      const { camera: c, mic: m, screen: s } = live.current;
      [c, m, s].forEach(stop);
    },
    [],
  );

  return {
    camera,
    mic,
    micMuted,
    /** Mic open and not muted: what attendees hear. */
    micOn: mic !== null && !micMuted,
    screen,
    error,
    busy,
    devices,
    cameraId: cameraId ?? camera?.getVideoTracks()[0]?.getSettings().deviceId ?? null,
    micId: micId ?? mic?.getAudioTracks()[0]?.getSettings().deviceId ?? null,
    speakerId,
    canShareScreen: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia),
    startCamera,
    stopCamera,
    toggleCamera,
    startMic,
    toggleMic,
    setMuted,
    toggleScreen,
    selectDevice,
    release,
  };
}

export type LocalMedia = ReturnType<typeof useLocalMedia>;

/** Rough input level (0–1) for a mic stream, for meters and the speaking indicator. */
export function useAudioLevel(stream: MediaStream | null) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!stream) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    // ~12 updates a second is plenty for a meter and much cheaper than every frame.
    const timer = setInterval(() => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setLevel(Math.min(1, avg / 60));
    }, 80);
    return () => {
      clearInterval(timer);
      void ctx.close();
      setLevel(0);
    };
  }, [stream]);
  return stream ? level : 0;
}
