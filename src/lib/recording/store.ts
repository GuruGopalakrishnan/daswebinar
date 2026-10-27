// IndexedDB storage for local recordings. Each MediaRecorder chunk is written
// as it arrives, so a crash, reload or closed tab loses at most one chunk
// (~2 s). Blobs read back from IndexedDB are disk-backed, so assembling a
// multi-GB recording doesn't load it into memory.

export type LocalRecording = {
  id: string;
  webinarId: string;
  title: string;
  mimeType: string;
  startedAt: string;
  endedAt: string | null;
  bytes: number;
  /** recording: still running, or the tab died mid-session (recoverable). */
  status: "recording" | "stopped" | "saved";
};

const DB_NAME = "local-recordings";
const VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("recordings", { keyPath: "id" });
      const chunks = db.createObjectStore("chunks", { autoIncrement: true });
      chunks.createIndex("byRecording", ["recordingId", "seq"]);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
  });
}

function request<T>(req: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function createRecording(meta: LocalRecording) {
  const db = await open();
  const tx = db.transaction("recordings", "readwrite");
  tx.objectStore("recordings").put(meta);
  await done(tx);
  db.close();
}

/** Appends a chunk and bumps the byte count in one transaction. */
export async function appendChunk(recordingId: string, seq: number, blob: Blob) {
  const db = await open();
  const tx = db.transaction(["recordings", "chunks"], "readwrite");
  tx.objectStore("chunks").add({ recordingId, seq, blob });
  const recordings = tx.objectStore("recordings");
  const meta = await request(recordings.get(recordingId) as IDBRequest<LocalRecording | undefined>);
  if (meta) recordings.put({ ...meta, bytes: meta.bytes + blob.size });
  await done(tx);
  db.close();
}

export async function updateRecording(id: string, patch: Partial<LocalRecording>) {
  const db = await open();
  const tx = db.transaction("recordings", "readwrite");
  const store = tx.objectStore("recordings");
  const meta = await request(store.get(id) as IDBRequest<LocalRecording | undefined>);
  if (meta) store.put({ ...meta, ...patch });
  await done(tx);
  db.close();
}

export async function listRecordings(): Promise<LocalRecording[]> {
  const db = await open();
  const all = await request(db.transaction("recordings").objectStore("recordings").getAll() as IDBRequest<LocalRecording[]>);
  db.close();
  return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function getRecordingBlob(id: string): Promise<Blob | null> {
  const db = await open();
  const tx = db.transaction(["recordings", "chunks"]);
  const meta = await request(tx.objectStore("recordings").get(id) as IDBRequest<LocalRecording | undefined>);
  if (!meta) {
    db.close();
    return null;
  }
  const range = IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]);
  const rows = await request(tx.objectStore("chunks").index("byRecording").getAll(range) as IDBRequest<{ blob: Blob }[]>);
  db.close();
  return new Blob(rows.map((r) => r.blob), { type: meta.mimeType });
}

export async function deleteRecording(id: string) {
  const db = await open();
  const tx = db.transaction(["recordings", "chunks"], "readwrite");
  tx.objectStore("recordings").delete(id);
  const index = tx.objectStore("chunks").index("byRecording");
  const keys = await request(index.getAllKeys(IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER])));
  for (const key of keys) tx.objectStore("chunks").delete(key);
  await done(tx);
  db.close();
}

export function fileNameFor(rec: Pick<LocalRecording, "title" | "startedAt" | "mimeType">) {
  const safe = rec.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "webinar";
  const date = rec.startedAt.slice(0, 16).replace("T", "_").replace(":", "-");
  return `${safe}_${date}.${rec.mimeType.includes("mp4") ? "mp4" : "webm"}`;
}

type SaveFilePicker = (options: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{ createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }>;

/**
 * Ask where to save, as early as possible: the picker needs a recent click, so
 * call this first in the click handler, before any other await.
 * Returns null when the browser has no picker (we fall back to a download) or
 * the user cancelled.
 */
export async function pickSaveTarget(suggestedName: string, mimeType: string) {
  const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  if (!picker) return { kind: "download" as const };
  const ext = mimeType.includes("mp4") ? ".mp4" : ".webm";
  try {
    const handle = await picker({
      suggestedName,
      types: [{ description: "Video", accept: { [mimeType.split(";")[0]!]: [ext] } }],
    });
    return { kind: "file" as const, handle };
  } catch {
    return { kind: "cancelled" as const };
  }
}

export async function writeToTarget(target: Awaited<ReturnType<typeof pickSaveTarget>>, blob: Blob, name: string) {
  if (target.kind === "cancelled") return false;
  if (target.kind === "file") {
    const writable = await target.handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
