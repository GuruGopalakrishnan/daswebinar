"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type MediaError = "denied" | "unavailable" | null;

/**
 * Local camera, microphone and screen capture. Turning a device off stops its
 * track (the camera light goes off) rather than just muting it.
 */
export function useLocalMedia() {
  const [camera, setCamera] = useState<MediaStream | null>(null);
  const [mic, setMic] = useState<MediaStream | null>(null);
  const [screen, setScreen] = useState<MediaStream | null>(null);
  const [error, setError] = useState<MediaError>(null);
  const [busy, setBusy] = useState(false);
  const streams = useRef<MediaStream[]>([]);

  const stop = (stream: MediaStream | null) => stream?.getTracks().forEach((t) => t.stop());

  const acquire = useCallback(async (constraints: MediaStreamConstraints) => {
    setBusy(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streams.current.push(stream);
      return stream;
    } catch (e) {
      setError(e instanceof DOMException && e.name === "NotAllowedError" ? "denied" : "unavailable");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const toggleCamera = useCallback(async () => {
    if (camera) {
      stop(camera);
      setCamera(null);
      return;
    }
    setCamera(await acquire({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } }));
  }, [camera, acquire]);

  const toggleMic = useCallback(async () => {
    if (mic) {
      stop(mic);
      setMic(null);
      return;
    }
    setMic(await acquire({ audio: { echoCancellation: true, noiseSuppression: true } }));
  }, [mic, acquire]);

  const toggleScreen = useCallback(async () => {
    if (screen) {
      stop(screen);
      setScreen(null);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      streams.current.push(stream);
      // The browser's own "Stop sharing" button ends the track.
      stream.getVideoTracks()[0]?.addEventListener("ended", () => setScreen(null));
      setScreen(stream);
    } catch {
      // User cancelled the picker; nothing to do.
    }
  }, [screen]);

  useEffect(
    () => () => {
      streams.current.forEach(stop);
    },
    [],
  );

  return {
    camera,
    mic,
    screen,
    error,
    busy,
    canShareScreen: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia),
    toggleCamera,
    toggleMic,
    toggleScreen,
  };
}

/** Rough input level (0–1) for a mic stream, for the speaking indicator. */
export function useAudioLevel(stream: MediaStream | null) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!stream) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setLevel(Math.min(1, avg / 60));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      void ctx.close();
      setLevel(0);
    };
  }, [stream]);
  return stream ? level : 0;
}
