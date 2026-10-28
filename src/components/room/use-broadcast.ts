"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  IAgoraRTC,
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ILocalAudioTrack,
  ILocalVideoTrack,
  IRemoteAudioTrack,
  IRemoteVideoTrack,
  UID,
} from "agora-rtc-sdk-ng";
import type { RtcCredentials } from "@/lib/agora/types";

/**
 * idle: not on air. unavailable: Agora isn't configured on the server.
 * The host and panelists publish; attendees join as audience. Everyone plays
 * only the host's uids and the current panelists' uids.
 */
export type BroadcastState = "idle" | "connecting" | "reconnecting" | "connected" | "unavailable" | "error";

/** One remote publisher we render: the host, the host's screen, or a panelist. */
export type RemoteFeed = { video: IRemoteVideoTrack | null; audio: boolean; level: number };

export type Broadcast = {
  state: BroadcastState;
  error: string | null;
  /** The uid we joined as (host 1, panelist 100–105, attendee random). */
  selfUid: number | null;
  hostUid: number;
  screenUid: number;
  /** Remote publishers by uid, never including ourselves. */
  feeds: Record<number, RemoteFeed>;
  /** The host's camera, if published and we're not the host. */
  hostVideo: IRemoteVideoTrack | null;
  /** The host's screen share, if published and we're not the host. */
  screenVideo: IRemoteVideoTrack | null;
  /** The host's microphone is live (for non-hosts). */
  hostAudio: boolean;
  /** The browser blocked audio until the user interacts with the page. */
  audioBlocked: boolean;
  unblockAudio: () => void;
  /** Agora network quality, 0 unknown, 1 excellent … 5 very bad, 6 down. Uplink for publishers, downlink for attendees. */
  network: number;
  /** Playback volume 0–100. */
  volume: number;
  setVolume: (v: number) => void;
};

type Options = {
  webinarId: string;
  /** Host or panelist: may publish. Changing it rejoins with new credentials. */
  canPublish: boolean;
  /** Live, or practice for the host and panelists. */
  onAir: boolean;
  /** Current panelists' Agora uids, from the room state. */
  stageUids: number[];
  camera: MediaStream | null;
  mic: MediaStream | null;
  micMuted: boolean;
  screen: MediaStream | null;
  speakerId: string | null;
};

type Published = { source: MediaStreamTrack; track: ILocalVideoTrack | ILocalAudioTrack };
type Slot = "camera" | "mic" | "screen" | "screenAudio";

class NotConfigured extends Error {}

async function fetchCredentials(webinarId: string): Promise<RtcCredentials> {
  const res = await fetch(`/api/webinars/${webinarId}/rtc-token`, { method: "POST" });
  const json = await res.json().catch(() => null);
  if (res.status === 503) throw new NotConfigured();
  if (!res.ok) throw new Error(json?.error?.message ?? "Couldn't connect to the video broadcast.");
  return json.data as RtcCredentials;
}

function omit<T>(record: Record<number, T>, key: number): Record<number, T> {
  const copy = { ...record };
  delete copy[key];
  return copy;
}

/** Refs and setters the subscribe helpers need; all stable across renders. */
type FeedEnv = {
  stage: { current: Set<number> };
  audio: { current: Map<UID, IRemoteAudioTrack> };
  prefs: { current: { volume: number; speakerId: string | null } };
  setVideos: React.Dispatch<React.SetStateAction<Record<number, IRemoteVideoTrack>>>;
  setAudios: React.Dispatch<React.SetStateAction<Record<number, true>>>;
};

/** Only the host's uids and current panelists are ever played; never ourselves. */
function watched(env: FeedEnv, creds: RtcCredentials, uid: number) {
  if (uid === creds.uid) return false;
  return uid === creds.hostUid || uid === creds.screenUid || env.stage.current.has(uid);
}

async function attach(env: FeedEnv, client: IAgoraRTCClient, creds: RtcCredentials, user: IAgoraRTCRemoteUser, mediaType: "audio" | "video") {
  const uid = Number(user.uid);
  if (!watched(env, creds, uid)) return;
  try {
    await client.subscribe(user, mediaType);
  } catch {
    return;
  }
  if (mediaType === "video" && user.videoTrack) {
    const track = user.videoTrack;
    env.setVideos((v) => ({ ...v, [uid]: track }));
    // Drop to the low stream rather than stall when bandwidth dips.
    if (uid !== creds.screenUid) void client.setStreamFallbackOption(user.uid, 1).catch(() => {});
  }
  if (mediaType === "audio" && user.audioTrack) {
    const track = user.audioTrack;
    env.audio.current.set(uid, track);
    track.setVolume(env.prefs.current.volume);
    if (env.prefs.current.speakerId) void track.setPlaybackDevice?.(env.prefs.current.speakerId).catch(() => {});
    track.play();
    env.setAudios((a) => ({ ...a, [uid]: true }));
  }
}

function detach(env: FeedEnv, uid: number, mediaType?: "audio" | "video") {
  if (mediaType !== "audio") env.setVideos((v) => omit(v, uid));
  if (mediaType !== "video") {
    env.audio.current.get(uid)?.stop();
    env.audio.current.delete(uid);
    env.setAudios((a) => omit(a, uid));
  }
}

const MAX_RETRIES = 8;
// Matches HOST_UID / HOST_SCREEN_UID in src/lib/agora/server.ts; replaced by the credentials once joined.
const DEFAULT_HOST_UID = 1;
const DEFAULT_SCREEN_UID = 2;

export function useBroadcast({ webinarId, canPublish, onAir, stageUids, camera, mic, micMuted, screen, speakerId }: Options): Broadcast {
  const [phase, setPhase] = useState<Exclude<BroadcastState, "idle"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<Record<number, IRemoteVideoTrack>>({});
  const [audios, setAudios] = useState<Record<number, true>>({});
  const [levels, setLevels] = useState<Record<number, number>>({});
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [network, setNetwork] = useState(0);
  const [volume, setVolume] = useState(100);
  // Bumped to rejoin after a fatal error (expired token, dropped connection).
  const [attempt, setAttempt] = useState(0);
  const [session, setSession] = useState<{ rtc: IAgoraRTC; client: IAgoraRTCClient; creds: RtcCredentials } | null>(null);

  const remoteAudioRef = useRef(new Map<UID, IRemoteAudioTrack>());
  const published = useRef<Partial<Record<Slot, Published>>>({});
  const screenClient = useRef<IAgoraRTCClient | null>(null);
  const failures = useRef(0);
  const prefs = useRef({ volume, speakerId });
  // Publish/unpublish calls are serialized so quick toggles can't interleave.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const stageKey = [...stageUids].sort((a, b) => a - b).join(",");
  const stageRef = useRef(new Set(stageUids));
  const env = useMemo<FeedEnv>(
    () => ({ stage: stageRef, audio: remoteAudioRef, prefs, setVideos, setAudios }),
    [],
  );

  useEffect(() => {
    prefs.current = { volume, speakerId };
    for (const track of remoteAudioRef.current.values()) {
      track.setVolume(volume);
      if (speakerId) void track.setPlaybackDevice?.(speakerId).catch(() => {});
    }
  }, [volume, speakerId]);

  // --- join / leave ---------------------------------------------------------
  useEffect(() => {
    if (!onAir) return;
    let cancelled = false;
    let client: IAgoraRTCClient | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const audioTracks = remoteAudioRef.current;

    const fail = (message: string) => {
      if (cancelled) return;
      setPhase(failures.current < MAX_RETRIES ? "reconnecting" : "error");
      setError(message);
      if (failures.current >= MAX_RETRIES) return;
      const delay = Math.min(20_000, 1000 * 2 ** failures.current);
      failures.current += 1;
      retryTimer = setTimeout(() => setAttempt((a) => a + 1), delay);
    };

    (async () => {
      const { default: AgoraRTC } = await import("agora-rtc-sdk-ng");
      AgoraRTC.setLogLevel(3);
      const creds = await fetchCredentials(webinarId);
      if (cancelled) return;

      client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
      if (creds.role !== "audience") {
        await client.setClientRole("host");
        // A small second stream lets viewers on weak networks fall back to it
        // instead of freezing.
        try {
          await client.enableDualStream();
          client.setLowStreamParameter({ width: 320, height: 180, framerate: 15, bitrate: 200 });
        } catch {
          // Not supported on this browser; viewers get the single stream.
        }
      } else {
        await client.setClientRole("audience", { level: 1 /* low latency */ });
      }

      client.on("token-privilege-will-expire", async () => {
        try {
          const next = await fetchCredentials(webinarId);
          if (next.token) await client?.renewToken(next.token);
          if (next.screen?.token) await screenClient.current?.renewToken(next.screen.token);
        } catch {
          // token-privilege-did-expire follows; we rejoin from there.
        }
      });
      client.on("token-privilege-did-expire", () => fail("The video session expired. Reconnecting…"));
      client.on("connection-state-change", (current, _prev, reason) => {
        if (current === "RECONNECTING") setPhase("reconnecting");
        else if (current === "CONNECTED") {
          failures.current = 0;
          setPhase("connected");
          setError(null);
        } else if (current === "DISCONNECTED" && reason && reason !== "LEAVE") {
          fail("Connection lost. Reconnecting…");
        }
      });
      client.on("network-quality", (q) => {
        setNetwork(creds.role === "audience" ? q.downlinkNetworkQuality : q.uplinkNetworkQuality);
      });

      AgoraRTC.onAutoplayFailed = () => setAudioBlocked(true);
      client.on("user-published", (user, mediaType) => {
        if (client && mediaType !== "datachannel") void attach(env, client, creds, user, mediaType);
      });
      client.on("user-unpublished", (user, mediaType) => {
        if (mediaType !== "datachannel") detach(env, Number(user.uid), mediaType);
      });
      client.on("user-left", (user) => detach(env, Number(user.uid)));

      await client.join(creds.appId, creds.channel, creds.token, creds.uid);
      if (cancelled) {
        await client.leave();
        return;
      }
      failures.current = 0;
      setPhase("connected");
      setError(null);
      setSession({ rtc: AgoraRTC, client, creds });
    })().catch((e: unknown) => {
      if (cancelled) return;
      if (e instanceof NotConfigured) {
        setPhase("unavailable");
        return;
      }
      fail(e instanceof Error ? e.message : "Couldn't connect to the video broadcast.");
    });

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      setSession(null);
      setVideos({});
      setAudios({});
      setLevels({});
      setAudioBlocked(false);
      setNetwork(0);
      setPhase(null);
      audioTracks.clear();
      const leaving = client;
      queue.current = queue.current.then(async () => {
        for (const p of Object.values(published.current)) p?.track.close();
        published.current = {};
        await screenClient.current?.leave().catch(() => {});
        screenClient.current = null;
        await leaving?.leave().catch(() => {});
      });
    };
    // canPublish: a promotion or demotion needs new credentials and client role.
  }, [webinarId, onAir, canPublish, attempt, env]);

  useEffect(() => {
    if (!onAir) failures.current = 0;
  }, [onAir]);

  // --- the stage changed: subscribe to new panelists, drop demoted ones -----
  useEffect(() => {
    stageRef.current = new Set(stageKey ? stageKey.split(",").map(Number) : []);
    if (!session) return;
    const { client, creds } = session;
    for (const user of client.remoteUsers) {
      const uid = Number(user.uid);
      if (watched(env, creds, uid)) {
        if (user.hasVideo && !user.videoTrack) void attach(env, client, creds, user, "video");
        if (user.hasAudio && !user.audioTrack) void attach(env, client, creds, user, "audio");
      } else if (user.videoTrack || user.audioTrack) {
        void client.unsubscribe(user).catch(() => {});
        detach(env, uid);
      }
    }
  }, [session, stageKey, env]);

  // --- speaking levels for remote audio (cheap polling, ~5×/s) -------------
  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => {
      const next: Record<number, number> = {};
      for (const [uid, track] of remoteAudioRef.current) next[Number(uid)] = Math.round(track.getVolumeLevel() * 10) / 10;
      setLevels((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    }, 200);
    return () => clearInterval(timer);
  }, [session]);

  // --- host / panelist: publish whatever the local media currently is -------
  useEffect(() => {
    if (!canPublish || !session || session.creds.role === "audience") return;
    const { rtc, client, creds } = session;
    const want: Record<Slot, MediaStreamTrack | null> = {
      camera: camera?.getVideoTracks()[0] ?? null,
      // Muted = not published, so viewers see the muted state and no audio is sent.
      mic: micMuted ? null : (mic?.getAudioTracks()[0] ?? null),
      // Only the host has a screen-share connection.
      screen: creds.screen ? (screen?.getVideoTracks()[0] ?? null) : null,
      screenAudio: creds.screen ? (screen?.getAudioTracks()[0] ?? null) : null,
    };

    // Publish a clone: closing the Agora track stops it, not the local preview.
    const create = (slot: Slot, source: MediaStreamTrack) => {
      switch (slot) {
        case "camera":
          return rtc.createCustomVideoTrack({ mediaStreamTrack: source.clone(), optimizationMode: "motion", bitrateMax: 1200 });
        case "screen":
          return rtc.createCustomVideoTrack({ mediaStreamTrack: source.clone(), optimizationMode: "detail", bitrateMin: 400, bitrateMax: 2000 });
        default:
          return rtc.createCustomAudioTrack({ mediaStreamTrack: source.clone() });
      }
    };

    const sync = async (target: IAgoraRTCClient, slot: Slot) => {
      const current = published.current[slot];
      if (current?.source === want[slot]) return;
      if (current) {
        await target.unpublish(current.track).catch(() => {});
        current.track.close();
        published.current[slot] = undefined;
      }
      const source = want[slot];
      if (!source || source.readyState === "ended") return;
      const track = create(slot, source);
      await target.publish(track);
      published.current[slot] = { source, track };
    };

    queue.current = queue.current
      .then(async () => {
        await sync(client, "camera");
        await sync(client, "mic");

        // Screen share rides on its own connection, opened only while presenting.
        if (want.screen && !screenClient.current && creds.screen) {
          const sc = rtc.createClient({ mode: "live", codec: "vp8" });
          await sc.setClientRole("host");
          await sc.join(creds.appId, creds.channel, creds.screen.token, creds.screen.uid);
          screenClient.current = sc;
        }
        if (screenClient.current) {
          await sync(screenClient.current, "screen");
          await sync(screenClient.current, "screenAudio");
          if (!want.screen) {
            await screenClient.current.leave().catch(() => {});
            screenClient.current = null;
          }
        }
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Couldn't publish your video.");
      });
  }, [canPublish, session, camera, mic, micMuted, screen]);

  const hostUid = session?.creds.hostUid ?? DEFAULT_HOST_UID;
  const screenUid = session?.creds.screenUid ?? DEFAULT_SCREEN_UID;
  const feeds = useMemo(() => {
    const out: Record<number, RemoteFeed> = {};
    for (const uid of new Set([...Object.keys(videos), ...Object.keys(audios)].map(Number))) {
      out[uid] = { video: videos[uid] ?? null, audio: Boolean(audios[uid]), level: levels[uid] ?? 0 };
    }
    return out;
  }, [videos, audios, levels]);

  return {
    state: !onAir ? "idle" : phase === null ? "connecting" : phase,
    error,
    selfUid: session?.creds.uid ?? null,
    hostUid,
    screenUid,
    feeds,
    hostVideo: feeds[hostUid]?.video ?? null,
    screenVideo: feeds[screenUid]?.video ?? null,
    hostAudio: feeds[hostUid]?.audio ?? false,
    audioBlocked,
    unblockAudio: () => {
      for (const track of remoteAudioRef.current.values()) track.play();
      setAudioBlocked(false);
    },
    network,
    volume,
    setVolume,
  };
}
