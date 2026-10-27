"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, HardDriveDownload, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  deleteRecording,
  fileNameFor,
  getRecordingBlob,
  listRecordings,
  pickSaveTarget,
  updateRecording,
  writeToTarget,
  type LocalRecording,
} from "@/lib/recording/store";

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function formatDuration(rec: LocalRecording) {
  if (!rec.endedAt) return null;
  const s = Math.round((Date.parse(rec.endedAt) - Date.parse(rec.startedAt)) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

/** Recordings kept in this browser (IndexedDB). They never leave the device. */
export function LocalRecordings() {
  const [items, setItems] = useState<LocalRecording[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await listRecordings());
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    listRecordings()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  async function save(rec: LocalRecording) {
    const name = fileNameFor(rec);
    const target = await pickSaveTarget(name, rec.mimeType);
    setBusy(rec.id);
    try {
      const blob = await getRecordingBlob(rec.id);
      if (blob && (await writeToTarget(target, blob, name))) {
        await updateRecording(rec.id, { status: "saved", endedAt: rec.endedAt ?? new Date().toISOString() });
        toast.success("Saved", { description: name });
        void refresh();
      }
    } catch {
      toast.error("Couldn't save the file.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(rec: LocalRecording) {
    if (!window.confirm(`Delete "${rec.title}" from this browser? Files you already saved to your computer are not affected.`)) return;
    await deleteRecording(rec.id);
    void refresh();
  }

  if (items === null) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-12 text-center">
        <HardDriveDownload className="size-6 text-muted-foreground" />
        <p className="font-medium">No recordings on this computer yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          In the live room, open the ••• menu and choose “Record to this computer”. Recordings appear here and you choose where
          to save the file when you stop.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y rounded-2xl border bg-card">
      {items.map((rec) => {
        const interrupted = rec.status === "recording";
        return (
          <li key={rec.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{rec.title}</p>
              <p className="text-sm text-muted-foreground">
                {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(rec.startedAt))}
                {" · "}
                {formatBytes(rec.bytes)}
                {formatDuration(rec) && ` · ${formatDuration(rec)}`}
              </p>
              {interrupted && (
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-warning">
                  <RotateCcw className="size-3" /> Recovered after an interruption — everything up to the last few seconds is here.
                </p>
              )}
              {rec.status === "saved" && <p className="mt-1 text-xs text-success">Saved to your computer</p>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant={rec.status === "saved" ? "outline" : "default"} onClick={() => void save(rec)} disabled={busy === rec.id}>
                {busy === rec.id ? <Loader2 className="animate-spin" /> : <Download />}
                {rec.status === "saved" ? "Save again" : "Save file"}
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={() => void remove(rec)} aria-label="Delete from this browser">
                <Trash2 />
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
