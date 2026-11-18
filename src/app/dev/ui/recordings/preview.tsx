"use client";

import { useState } from "react";
import { RecordingsList } from "@/components/dashboard/local-recordings";
import { useMounted } from "@/hooks/use-client-values";
import type { LocalRecording } from "@/lib/recording/store";

export type State = "list" | "saving" | "failed" | "loading" | "empty" | "unavailable";

const MB = 1024 * 1024;

function sample(now: number): LocalRecording[] {
  const at = (hoursAgo: number, minutes: number) => ({
    startedAt: new Date(now - hoursAgo * 3_600_000).toISOString(),
    endedAt: new Date(now - hoursAgo * 3_600_000 + minutes * 60_000).toISOString(),
  });
  return [
    { id: "sample-1", webinarId: "w1", title: "Growth Masterclass for Coaches", mimeType: "video/webm", ...at(3, 58), bytes: 812 * MB, status: "stopped" },
    { id: "sample-2", webinarId: "w2", title: "Pricing Your Offer Workshop", mimeType: "video/webm", ...at(50, 44), bytes: 640 * MB, status: "saved" },
    { id: "sample-3", webinarId: "w3", title: "Live Q&A: Building Your First Funnel", mimeType: "video/webm", startedAt: new Date(now - 170 * 3_600_000).toISOString(), endedAt: null, bytes: 233 * MB, status: "recording" },
  ];
}

/** Sample rows in memory only; the real IndexedDB store is never touched. */
export function RecordingsPreview({ state, now }: { state: State; now: number }) {
  const mounted = useMounted();
  const [items, setItems] = useState(() => sample(now));
  if (!mounted) return null;
  return (
    <RecordingsList
      items={state === "loading" ? null : state === "empty" || state === "unavailable" ? [] : items}
      unavailable={state === "unavailable"}
      busyId={state === "saving" ? "sample-1" : null}
      failedId={state === "failed" ? "sample-1" : null}
      onSave={(rec) => setItems((xs) => xs.map((x) => (x.id === rec.id ? { ...x, status: "saved" } : x)))}
      onDelete={(rec) => setItems((xs) => xs.filter((x) => x.id !== rec.id))}
    />
  );
}
