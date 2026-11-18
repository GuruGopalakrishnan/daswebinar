"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Film, HardDriveDownload, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Callout } from "@/components/blocks/callout";
import { EmptyState } from "@/components/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { cn } from "@/lib/utils";

export function formatBytes(n: number) {
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

/** Recordings kept in this browser (IndexedDB). They never leave the device. Storage logic is unchanged. */
export function LocalRecordings() {
  const [items, setItems] = useState<LocalRecording[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listRecordings());
      setUnavailable(false);
    } catch {
      // IndexedDB blocked (private window, storage disabled): say so instead of showing an empty list.
      setItems([]);
      setUnavailable(true);
    }
  }, []);

  useEffect(() => {
    listRecordings()
      .then(setItems)
      .catch(() => {
        setItems([]);
        setUnavailable(true);
      });
  }, []);

  async function save(rec: LocalRecording) {
    const name = fileNameFor(rec);
    const target = await pickSaveTarget(name, rec.mimeType);
    setBusy(rec.id);
    setFailed(null);
    try {
      const blob = await getRecordingBlob(rec.id);
      if (blob && (await writeToTarget(target, blob, name))) {
        await updateRecording(rec.id, { status: "saved", endedAt: rec.endedAt ?? new Date().toISOString() });
        toast.success("Saved", { description: name });
        void load();
      }
    } catch {
      setFailed(rec.id);
      toast.error("Couldn't save the file.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(rec: LocalRecording) {
    await deleteRecording(rec.id);
    void load();
  }

  return (
    <RecordingsList
      items={items}
      unavailable={unavailable}
      busyId={busy}
      failedId={failed}
      onSave={(rec) => void save(rec)}
      onDelete={(rec) => remove(rec)}
    />
  );
}

/** Presentational list of local recordings: loading, empty, unavailable, and each row's state. */
export function RecordingsList({
  items,
  unavailable,
  busyId,
  failedId,
  onSave,
  onDelete,
}: {
  items: LocalRecording[] | null;
  unavailable: boolean;
  busyId: string | null;
  failedId: string | null;
  onSave: (rec: LocalRecording) => void;
  onDelete: (rec: LocalRecording) => Promise<void> | void;
}) {
  const [confirm, setConfirm] = useState<LocalRecording | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (items === null) {
    return (
      <div className="grid gap-3" aria-busy="true" aria-label="Loading recordings">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[88px] rounded-xl" />
        ))}
      </div>
    );
  }

  if (unavailable) {
    return (
      <Callout tone="warn" title="Recordings aren't available in this browser">
        This browser is blocking local storage (for example, a private window). Open the dashboard in a normal window on
        the computer you recorded on.
      </Callout>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card">
        <EmptyState
          icon={HardDriveDownload}
          title="No recordings on this computer yet"
          description="In the live room, open the ••• menu and choose “Record to this computer”. Recordings appear here, and you choose where to save the file when you stop."
        />
      </div>
    );
  }

  const total = items.reduce((sum, r) => sum + r.bytes, 0);
  const toSave = items.filter((r) => r.status !== "saved").length;

  return (
    <div className="grid gap-3">
      <p className="text-[13px] text-muted-foreground">
        {items.length} {items.length === 1 ? "recording" : "recordings"} · {formatBytes(total)} on this computer
        {toSave > 0 && (
          <>
            {" · "}
            <span className="font-medium text-foreground">{toSave} not saved to a file yet</span>
          </>
        )}
      </p>
      <ul className="grid gap-3">
        {items.map((rec) => (
          <RecordingRow
            key={rec.id}
            rec={rec}
            busy={busyId === rec.id}
            failed={failedId === rec.id}
            onSave={() => onSave(rec)}
            onDelete={() => setConfirm(rec)}
          />
        ))}
      </ul>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this recording from the browser?</AlertDialogTitle>
            <AlertDialogDescription>
              “{confirm?.title}” will be removed from this browser. Files you already saved to your computer are not
              affected.
              {confirm && confirm.status !== "saved" && " You haven't saved this one to a file yet, so it will be gone for good."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!confirm) return;
                setDeleting(true);
                try {
                  await onDelete(confirm);
                } finally {
                  setDeleting(false);
                  setConfirm(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RecordingRow({
  rec,
  busy,
  failed,
  onSave,
  onDelete,
}: {
  rec: LocalRecording;
  busy: boolean;
  failed: boolean;
  onSave: () => void;
  onDelete: () => void;
}) {
  const recovered = rec.status === "recording";
  const saved = rec.status === "saved";
  const duration = formatDuration(rec);

  return (
    <li
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 shadow-card sm:flex-row sm:items-center",
        failed && "border-[color-mix(in_oklch,var(--destructive)_40%,transparent)]",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <span
          aria-hidden
          className="flex aspect-video w-20 shrink-0 items-center justify-center rounded-md bg-stage text-white/75 sm:w-24"
        >
          <Film className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="t-title min-w-0 truncate">{rec.title}</p>
            <StatusBadge status={busy ? "saving" : failed ? "failed" : recovered ? "recovered" : saved ? "saved" : "ready"} />
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(rec.startedAt))}
            {duration && <span className="tabular-nums"> · {duration}</span>}
            {" · "}
            <span className="tabular-nums">{formatBytes(rec.bytes)}</span>
          </p>
          {recovered && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-warning-text">
              <RotateCcw aria-hidden className="mt-px size-3 shrink-0" />
              Recovered after an interruption. Everything up to the last few seconds is here.
            </p>
          )}
          {failed && (
            <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs text-destructive">
              <AlertTriangle aria-hidden className="mt-px size-3 shrink-0" />
              Couldn&apos;t write the file. Check there&apos;s enough disk space, then try again.
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:justify-end">
        <Button
          size="sm"
          variant={saved ? "outline" : "default"}
          onClick={onSave}
          loading={busy}
          className="max-sm:flex-1"
        >
          {!busy && <Download />}
          {busy ? "Saving…" : failed ? "Try again" : saved ? "Save again" : "Save file"}
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={onDelete} disabled={busy} aria-label={`Delete “${rec.title}” from this browser`}>
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: "saving" | "failed" | "recovered" | "saved" | "ready" }) {
  switch (status) {
    case "saving":
      return <Badge variant="teal">Saving…</Badge>;
    case "failed":
      return <Badge variant="danger">Save failed</Badge>;
    case "recovered":
      return <Badge variant="warning">Recovered</Badge>;
    case "saved":
      return (
        <Badge variant="success">
          <CheckCircle2 /> Saved
        </Badge>
      );
    default:
      return <Badge variant="navy">Ready to save</Badge>;
  }
}
