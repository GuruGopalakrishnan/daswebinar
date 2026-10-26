import { io, type Socket } from "socket.io-client";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  C2S,
  type Ack,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from "../../../server/socket/protocol";

export type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";
const HEARTBEAT_MS = 25_000;

/**
 * Connects to the realtime server with the current Supabase access token.
 * The token is re-read on every (re)connect and pushed to the server when
 * Supabase refreshes it, so long sessions don't get dropped.
 */
export function connectRealtime(supabase: SupabaseClient) {
  const socket: RealtimeSocket = io(SOCKET_URL, {
    autoConnect: false,
    transports: ["websocket"],
    auth: (cb) => {
      supabase.auth.getSession().then(({ data }) => cb({ token: data.session?.access_token ?? "" }));
    },
  });

  const { data: auth } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === "TOKEN_REFRESHED" && session && socket.connected) {
      socket.emit(C2S.REFRESH_TOKEN, { token: session.access_token }, () => {});
    }
    if (event === "SIGNED_OUT") socket.disconnect();
  });

  const heartbeat = setInterval(() => {
    if (socket.connected) socket.emit(C2S.HEARTBEAT, {}, () => {});
  }, HEARTBEAT_MS);

  socket.connect();

  return {
    socket,
    close() {
      clearInterval(heartbeat);
      auth.subscription.unsubscribe();
      socket.disconnect();
    },
  };
}

/** Promise wrapper for ack-style emits. */
export function request<T>(
  socket: RealtimeSocket,
  event: keyof ClientToServerEvents,
  payload: unknown,
  timeoutMs = 5000,
): Promise<Ack<T>> {
  return (socket as unknown as Socket).timeout(timeoutMs).emitWithAck(event, payload);
}
