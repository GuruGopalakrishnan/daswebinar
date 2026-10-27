// Records the host's program (screen + camera picture-in-picture + mic) on the
// host's own machine.
//
// Why it doesn't hurt the live stream:
//   * It reads the same local MediaStreams the broadcast uses; nothing is sent
//     over the network and the live encoder is untouched.
//   * Frames are composited at 720p / 24 fps on a canvas (GPU-accelerated
//     drawImage) and encoded by the browser's MediaRecorder, which uses
//     hardware H.264 where available.
//   * The draw loop is driven by a Web Worker timer. Main-thread timers and
//     requestAnimationFrame are throttled or paused when the host switches to
//     their slides app, which would freeze the recording; worker timers aren't.
//   * Chunks go to IndexedDB every 2 s (see store.ts), so memory stays flat no
//     matter how long the session runs.

import { appendChunk, createRecording, updateRecording } from "./store";

export type RecorderSources = {
  camera: MediaStream | null;
  screen: MediaStream | null;
  mic: MediaStream | null;
  micMuted: boolean;
  hostName: string;
};

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 24;
const CHUNK_MS = 2000;

const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01F,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

export function canRecord() {
  return typeof window !== "undefined" && pickMimeType() !== null && typeof indexedDB !== "undefined" && "captureStream" in HTMLCanvasElement.prototype;
}

// Kept in the DOM (tiny, transparent): some browsers stop producing frames for
// detached or off-screen videos.
function hiddenVideo() {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.autoplay = true;
  v.setAttribute("aria-hidden", "true");
  Object.assign(v.style, { position: "fixed", right: "0", bottom: "0", width: "2px", height: "2px", opacity: "0.01", pointerEvents: "none" });
  document.body.appendChild(v);
  return v;
}

function workerTicker(fps: number, onTick: () => void) {
  const src = `let t=setInterval(()=>postMessage(0),${Math.round(1000 / fps)});onmessage=()=>{clearInterval(t);close()}`;
  const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
  const worker = new Worker(url);
  worker.onmessage = onTick;
  return () => {
    worker.postMessage("stop");
    worker.terminate();
    URL.revokeObjectURL(url);
  };
}

export class LocalRecorder {
  readonly id = crypto.randomUUID();
  readonly mimeType: string;
  private canvas = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D;
  private screenEl = hiddenVideo();
  private cameraEl = hiddenVideo();
  private audio = new AudioContext();
  private audioDest = this.audio.createMediaStreamDestination();
  private micGain = this.audio.createGain();
  private micNode: MediaStreamAudioSourceNode | null = null;
  private screenAudioNode: MediaStreamAudioSourceNode | null = null;
  private recorder: MediaRecorder;
  private stopTicker: () => void = () => {};
  private seq = 0;
  private writes: Promise<void> = Promise.resolve();
  private sources: RecorderSources;
  readonly startedAt = new Date();
  bytes = 0;
  onError: (message: string) => void = () => {};

  constructor(
    private meta: { webinarId: string; title: string },
    sources: RecorderSources,
  ) {
    const mime = pickMimeType();
    if (!mime) throw new Error("This browser can't record. Use Chrome or Edge on a computer.");
    this.mimeType = mime;
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.ctx = this.canvas.getContext("2d", { alpha: false })!;
    this.micGain.connect(this.audioDest);
    this.sources = sources;
    this.update(sources);

    const stream = new MediaStream([
      ...this.canvas.captureStream(FPS).getVideoTracks(),
      ...this.audioDest.stream.getAudioTracks(),
    ]);
    this.recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 2_500_000,
      audioBitsPerSecond: 128_000,
    });
    this.recorder.ondataavailable = (e) => {
      if (!e.data.size) return;
      const seq = this.seq++;
      this.bytes += e.data.size;
      this.writes = this.writes
        .then(() => appendChunk(this.id, seq, e.data))
        .catch(() => this.onError("Couldn't save part of the recording. Free up disk space."));
    };
    this.recorder.onerror = () => this.onError("Recording stopped unexpectedly.");
  }

  async start() {
    await this.audio.resume();
    await createRecording({
      id: this.id,
      webinarId: this.meta.webinarId,
      title: this.meta.title,
      mimeType: this.mimeType,
      startedAt: this.startedAt.toISOString(),
      endedAt: null,
      bytes: 0,
      status: "recording",
    });
    this.draw();
    this.stopTicker = workerTicker(FPS, () => this.draw());
    this.recorder.start(CHUNK_MS);
  }

  /** Call whenever the host's media changes (camera on/off, screen share, mute). */
  update(sources: RecorderSources) {
    this.sources = sources;
    const attach = (el: HTMLVideoElement, stream: MediaStream | null) => {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
        if (stream) void el.play().catch(() => {});
      }
    };
    attach(this.screenEl, sources.screen);
    attach(this.cameraEl, sources.camera);

    const micTrack = sources.mic?.getAudioTracks()[0] ?? null;
    if (this.micNode?.mediaStream.getAudioTracks()[0] !== micTrack) {
      this.micNode?.disconnect();
      this.micNode = sources.mic ? this.audio.createMediaStreamSource(sources.mic) : null;
      this.micNode?.connect(this.micGain);
    }
    // Muted means silent in the recording too.
    this.micGain.gain.setTargetAtTime(sources.micMuted ? 0 : 1, this.audio.currentTime, 0.02);

    const screenAudio = sources.screen?.getAudioTracks()[0] ?? null;
    if (this.screenAudioNode?.mediaStream.getAudioTracks()[0] !== screenAudio) {
      this.screenAudioNode?.disconnect();
      this.screenAudioNode = screenAudio ? this.audio.createMediaStreamSource(new MediaStream([screenAudio])) : null;
      this.screenAudioNode?.connect(this.audioDest);
    }
  }

  private draw() {
    const { ctx } = this;
    const screenReady = this.sources.screen && this.screenEl.videoWidth > 0;
    const cameraReady = this.sources.camera && this.cameraEl.videoWidth > 0;
    ctx.fillStyle = "#151311";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    if (screenReady) {
      this.drawFit(this.screenEl, 0, 0, WIDTH, HEIGHT, "contain");
      if (cameraReady) {
        const w = WIDTH * 0.22;
        const h = (w * 9) / 16;
        const x = WIDTH - w - 24;
        const y = HEIGHT - h - 24;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 14);
        ctx.clip();
        this.drawFit(this.cameraEl, x, y, w, h, "cover");
        ctx.restore();
      }
    } else if (cameraReady) {
      this.drawFit(this.cameraEl, 0, 0, WIDTH, HEIGHT, "cover");
    } else {
      this.drawNameCard();
    }
  }

  private drawFit(el: HTMLVideoElement, x: number, y: number, w: number, h: number, mode: "contain" | "cover") {
    const vw = el.videoWidth;
    const vh = el.videoHeight;
    const scale = mode === "contain" ? Math.min(w / vw, h / vh) : Math.max(w / vw, h / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    this.ctx.drawImage(el, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  private drawNameCard() {
    const { ctx } = this;
    const name = this.sources.hostName;
    const initials = name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
    ctx.fillStyle = "#2b6f6a";
    ctx.beginPath();
    ctx.arc(WIDTH / 2, HEIGHT / 2 - 30, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 48px system-ui, sans-serif";
    ctx.fillText(initials, WIDTH / 2, HEIGHT / 2 - 30);
    ctx.font = "500 28px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText(name, WIDTH / 2, HEIGHT / 2 + 80);
  }

  /** Stops and waits for every chunk to reach IndexedDB. */
  async stop() {
    if (this.recorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        this.recorder.addEventListener("stop", () => resolve(), { once: true });
        this.recorder.stop();
      });
    }
    this.stopTicker();
    await this.writes;
    this.micNode?.disconnect();
    this.screenAudioNode?.disconnect();
    void this.audio.close();
    this.screenEl.srcObject = null;
    this.cameraEl.srcObject = null;
    this.screenEl.remove();
    this.cameraEl.remove();
    await updateRecording(this.id, { status: "stopped", endedAt: new Date().toISOString() });
  }
}
