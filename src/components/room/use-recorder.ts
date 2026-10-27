"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LocalRecorder, canRecord, type RecorderSources } from "@/lib/recording/recorder";
import { fileNameFor, getRecordingBlob, pickSaveTarget, updateRecording, writeToTarget } from "@/lib/recording/store";

export type RecorderState = "idle" | "starting" | "recording" | "saving";

/**
 * Host-side local recording. Starting/stopping also flips the room's
 * `recording` setting so every attendee sees the REC indicator.
 */
export function useRecorder({
  webinarId,
  title,
  sources,
  onRecordingChange,
}: {
  webinarId: string;
  title: string;
  sources: RecorderSources;
  onRecordingChange: (recording: boolean) => void;
}) {
  const [state, setState] = useState<RecorderState>("idle");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const recorder = useRef<LocalRecorder | null>(null);
  const supported = typeof window !== "undefined" && canRecord();

  useEffect(() => {
    recorder.current?.update(sources);
  }, [sources]);

  // Closing the tab mid-recording loses nothing (chunks are on disk), but warn anyway.
  useEffect(() => {
    if (state !== "recording") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state]);

  const start = useCallback(async () => {
    if (recorder.current) return;
    setState("starting");
    try {
      const r = new LocalRecorder({ webinarId, title }, sources);
      r.onError = (m) => toast.error(m);
      await r.start();
      recorder.current = r;
      setStartedAt(Date.now());
      setState("recording");
      onRecordingChange(true);
      toast.success("Recording started", { description: "Saved on this computer as you go." });
    } catch (e) {
      setState("idle");
      toast.error(e instanceof Error ? e.message : "Couldn't start recording.");
    }
  }, [webinarId, title, sources, onRecordingChange]);

  /**
   * Stops and asks where to save. Call straight from a click handler: the
   * file picker needs a recent user gesture, so it opens before anything else.
   */
  const stop = useCallback(async () => {
    const r = recorder.current;
    if (!r) return;
    const name = fileNameFor({ title, startedAt: r.startedAt.toISOString(), mimeType: r.mimeType });
    const target = await pickSaveTarget(name, r.mimeType);
    recorder.current = null;
    setState("saving");
    onRecordingChange(false);
    try {
      await r.stop();
      const blob = await getRecordingBlob(r.id);
      if (blob && (await writeToTarget(target, blob, name))) {
        await updateRecording(r.id, { status: "saved" });
        toast.success("Recording saved", { description: name });
      } else {
        toast("Recording kept on this device", {
          description: "Find it any time under Dashboard → Recordings.",
        });
      }
    } catch {
      toast.error("Couldn't save the file. It's kept under Dashboard → Recordings.");
    } finally {
      setState("idle");
      setStartedAt(null);
    }
  }, [title, onRecordingChange]);

  return { state, startedAt, supported, start, stop };
}
