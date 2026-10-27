"use client";

import { useEffect, useRef, useState } from "react";
import type {
  IAgoraRTC,
  IAgoraRTCClient,
  ILocalAudioTrack,
  ILocalVideoTrack,
  IRemoteAudioTrack,
  IRemoteVideoTrack,
  UID,
} from "agora-rtc-sdk-ng";
import type { RtcCredentials } from "@/lib/agora/types";

/**
 * idle: not live. unavailable: Agora isn't configured on the server.
 * The host publishes; attendees join as audience and only play the host's uids.
 */
export type BroadcastState = "idle" | "connecting" | "reconnecting" | "connected" | "unavailable" | "error";

export type Broadcast = {
  state: BroadcastState;
  error: string | null;
  /** Attendees: the host's camera, if published. */
  hostVideo: IRemoteVideoTrack | null;
  /** Attendees: the host's screen share, if published. */
  screenVideo: IRemoteVideoTrack | null;
  /** Attendees: the host's microphone is live. */
  hostAudio: boolean;
  /** Attendees: the browser blocked audio until the user interacts with the page. */
  audioBlocked: boolean;
  unblockAudio: () => void;
  /** Agora network quality, 0 unknown, 1 excellent … 5 very bad, 6 down. Uplink for the host, downlink for attendees. */
  network: number;
  /** Attendees: playback volume 0–100. */
  volume: number;
  setVolume: (v: number) => void;
};

type Options = {
  webinarId: string;
  isHost: boolean;
  live: boolean;
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

const MAX_RETRIES = 8;

export function useBroadcast({ webinarId, isHost, live, camera, mic, micMuted, screen, speakerId }: Options): Broadcast {
  const [phase, setPhase] = useState<Exclude<BroadcastState, "idle"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hostVideo, setHostVideo] = useState<IRemoteVideoTrack | null>(null);
  const [screenVideo, setScreenVideo] = useState<IRemoteVideoTrack | null>(null);
  const [hostAudio, setHostAudio] = useState(false);
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

  useEffect(() => {
    prefs.current = { volume, speakerId };
    for (const track of remoteAudioRef.current.values()) {
      track.setVolume(volume);
      if (speakerId) void track.setPlaybackDevice?.(speakerId).catch(() => {});
    }
  }, [volume, speakerId]);

  // --- join / leave ---------------------------------------------------------
  useEffect(() => {
    if (!live) return;
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

    const playAudio = (uid: UID, track: IRemoteAudioTrack) => {
      remoteAudioRef.current.set(uid, track);
      track.setVolume(prefs.current.volume);
      if (prefs.current.speakerId) void track.setPlaybackDevice?.(prefs.current.speakerId).catch(() => {});
      track.play();
    };

    (async () => {
      const { default: AgoraRTC } = await import("agora-rtc-sdk-ng");
      AgoraRTC.setLogLevel(3);
      const creds = await fetchCredentials(webinarId);
      if (cancelled) return;

      client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
      if (creds.role === "host") {
        await client.setClientRole("host");
        // A small second stream lets attendees on weak networks fall back to it
        // instead of freezing.
        try {
          await client.enableDualStream();
          client.setLowStreamParameter({ width: 320, height: 180, framerate: 15, bitrate: 200 });
        } catch {
          // Not supported on this browser; attendees get the single stream.
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
        setNetwork(creds.role === "host" ? q.uplinkNetworkQuality : q.downlinkNetworkQuality);
      });

      if (creds.role === "audience") {
        AgoraRTC.onAutoplayFailed = () => setAudioBlocked(true);
        const watched = new Set<UID>([creds.hostUid, creds.screenUid]);

        client.on("user-published", async (user, mediaType) => {
          if (!watched.has(user.uid) || !client) return;
          try {
            await client.subscribe(user, mediaType);
          } catch {
            return;
          }
          if (mediaType === "video") {
            if (user.uid === creds.hostUid) {
              setHostVideo(user.videoTrack ?? null);
              // Drop to the low stream rather than stall when bandwidth dips.
              void client.setStreamFallbackOption(user.uid, 1).catch(() => {});
            } else {
              setScreenVideo(user.videoTrack ?? null);
            }
          }
          if (mediaType === "audio" && user.audioTrack) {
            playAudio(user.uid, user.audioTrack);
            if (user.uid === creds.hostUid) setHostAudio(true);
          }
        });
        client.on("user-unpublished", (user, mediaType) => {
          if (!watched.has(user.uid)) return;
          if (mediaType === "video") {
            if (user.uid === creds.hostUid) setHostVideo(null);
            else setScreenVideo(null);
          }
          if (mediaType === "audio") {
            remoteAudioRef.current.delete(user.uid);
            if (user.uid === creds.hostUid) setHostAudio(false);
          }
        });
        client.on("user-left", (user) => {
          if (user.uid === creds.hostUid) {
            setHostVideo(null);
            setHostAudio(false);
          } else if (user.uid === creds.screenUid) {
            setScreenVideo(null);
          }
          remoteAudioRef.current.delete(user.uid);
        });
      }

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
      setHostVideo(null);
      setScreenVideo(null);
      setHostAudio(false);
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
  }, [webinarId, live, attempt]);

  useEffect(() => {
    if (!live) failures.current = 0;
  }, [live]);

  // --- host: publish whatever the local media currently is -----------------
  useEffect(() => {
    if (!isHost || !session) return;
    const { rtc, client, creds } = session;
    const want: Record<Slot, MediaStreamTrack | null> = {
      camera: camera?.getVideoTracks()[0] ?? null,
      // Muted = not published, so attendees see the muted state and no audio is sent.
      mic: micMuted ? null : (mic?.getAudioTracks()[0] ?? null),
      screen: screen?.getVideoTracks()[0] ?? null,
      screenAudio: screen?.getAudioTracks()[0] ?? null,
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
  }, [isHost, session, camera, mic, micMuted, screen]);

  return {
    state: !live ? "idle" : phase === null ? "connecting" : phase,
    error,
    hostVideo,
    screenVideo,
    hostAudio,
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
