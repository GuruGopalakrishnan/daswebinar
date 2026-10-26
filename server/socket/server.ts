// Socket.IO wiring: authentication, room membership, event handlers.
// Auth and access checks are injected so tests can run without Supabase.

import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import type { z } from "zod";
import {
  C2S,
  S2C,
  schemas,
  type Ack,
  type ClientToServerEvents,
  type Role,
  type ServerToClientEvents,
} from "./protocol.ts";
import type { AuthUser, ResolveAccess, VerifyToken } from "./auth.ts";
import { RateLimiter } from "./rate-limit.ts";
import { WebinarRoom, type Actor, type Result } from "./room.ts";

type SocketData = {
  user: AuthUser;
  webinarId: string | null;
  role: Role | null;
  lastHeartbeat: number;
  expiryTimer: NodeJS.Timeout | undefined;
};
type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type EventName = keyof typeof schemas;
type Input<E extends EventName> = z.output<(typeof schemas)[E]>;
type RoomCtx = { socket: AppSocket; actor: Actor; room: WebinarRoom };

export type RealtimeOptions = {
  verifyToken: VerifyToken;
  resolveAccess: ResolveAccess;
  corsOrigin: string | string[];
  /** Keep an empty room's state this long so a brief disconnect loses nothing. */
  roomGraceMs?: number;
  /** Disconnect sockets that haven't sent user_session:heartbeat in this long. */
  heartbeatTimeoutMs?: number;
};

const roomKey = (webinarId: string) => `webinar:${webinarId}`;

// Per-user limits, shared across that user's tabs.
const createLimits = (): Partial<Record<EventName, RateLimiter>> => ({
  [C2S.JOIN_WEBINAR]: new RateLimiter(10, 60_000),
  [C2S.REFRESH_TOKEN]: new RateLimiter(5, 60_000),
  [C2S.SEND_MESSAGE]: new RateLimiter(5, 10_000),
  [C2S.HEARTBEAT]: new RateLimiter(6, 30_000),
  [C2S.SUBMIT_QUESTION]: new RateLimiter(3, 30_000),
  [C2S.UPVOTE_QUESTION]: new RateLimiter(20, 10_000),
  [C2S.CREATE_POLL]: new RateLimiter(5, 60_000),
  [C2S.VOTE]: new RateLimiter(10, 10_000),
  [C2S.CLOSE_POLL]: new RateLimiter(10, 60_000),
  [C2S.RAISE_HAND]: new RateLimiter(5, 30_000),
  [C2S.LOWER_HAND]: new RateLimiter(20, 30_000),
  [C2S.SEND_REACTION]: new RateLimiter(10, 5_000),
  [C2S.UPDATE_SETTINGS]: new RateLimiter(10, 10_000),
  [C2S.ANNOUNCE_STATUS]: new RateLimiter(5, 60_000),
});

const toAck = <T>(result: Result<T>): Ack<T> =>
  result.ok
    ? { ok: true, data: result.value }
    : { ok: false, error: { code: result.code, message: result.message } };

const failure = (code: string, message: string): Result<never> => ({ ok: false, code, message });

export function createRealtimeServer(httpServer: HttpServer, options: RealtimeOptions) {
  const roomGraceMs = options.roomGraceMs ?? 30 * 60_000;
  const heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 75_000;

  const io: AppServer = new Server(httpServer, {
    cors: { origin: options.corsOrigin },
    maxHttpBufferSize: 16 * 1024,
  });

  const limits = createLimits();
  let closing = false;
  const rooms = new Map<string, WebinarRoom>();
  const emptyRoomTimers = new Map<string, NodeJS.Timeout>();
  const liveCountTimers = new Map<string, NodeJS.Timeout>();

  // --- helpers ---------------------------------------------------------------

  function actorOf(socket: AppSocket): Actor {
    const { user, role } = socket.data;
    return { userId: user.id, name: user.name, role: role ?? "attendee" };
  }

  function scheduleExpiry(socket: AppSocket) {
    clearTimeout(socket.data.expiryTimer);
    const delay = Math.max(0, socket.data.user.expiresAt - Date.now());
    socket.data.expiryTimer = setTimeout(() => {
      socket.emit(S2C.SESSION_EXPIRED);
      socket.disconnect(true);
    }, delay);
  }

  /** Debounced so a burst of joins/leaves sends one update. */
  function broadcastLiveCount(webinarId: string) {
    if (closing || liveCountTimers.has(webinarId)) return;
    liveCountTimers.set(
      webinarId,
      setTimeout(() => {
        liveCountTimers.delete(webinarId);
        const room = rooms.get(webinarId);
        if (!room) return;
        io.to(roomKey(webinarId)).emit(S2C.LIVE_COUNT, { liveCount: room.liveCount });
        io.to(roomKey(webinarId)).emit(S2C.ROSTER, room.roster());
      }, 300),
    );
  }

  function leaveRoom(socket: AppSocket) {
    const { webinarId, user } = socket.data;
    if (!webinarId) return;
    const room = rooms.get(webinarId);
    socket.data.webinarId = null;
    socket.data.role = null;
    if (!room) return;

    const { left, handLowered } = room.removeMember(user.id, socket.id);
    if (handLowered) io.to(roomKey(webinarId)).emit(S2C.HANDRAISE_QUEUE, room.handRaiseQueue());
    if (left) broadcastLiveCount(webinarId);

    if (room.isEmpty && !closing) {
      const timer = setTimeout(() => {
        emptyRoomTimers.delete(webinarId);
        if (rooms.get(webinarId)?.isEmpty) rooms.delete(webinarId);
      }, roomGraceMs);
      // Housekeeping only; must not keep the process alive.
      timer.unref();
      emptyRoomTimers.set(webinarId, timer);
    }
  }

  /**
   * Registers a validated, rate-limited event handler. Payloads that fail the
   * schema never reach the handler. Room events require a prior join.
   */
  function on<E extends EventName>(
    socket: AppSocket,
    event: E,
    handle: (input: Input<E>) => Result<unknown> | Promise<Result<unknown>>,
  ) {
    const raw = socket as unknown as {
      on(event: string, listener: (payload: unknown, ack: unknown) => void): void;
    };
    raw.on(event, async (payload, ack) => {
      const reply = (res: Ack<unknown>) => {
        if (typeof ack === "function") ack(res);
      };
      if (limits[event] && !limits[event].take(socket.data.user.id)) {
        return reply(toAck(failure("rate_limited", "Slow down.")));
      }
      const parsed = schemas[event].safeParse(payload ?? {});
      if (!parsed.success) {
        return reply(toAck(failure("invalid_payload", parsed.error.issues[0]?.message ?? "Invalid payload.")));
      }
      try {
        reply(toAck(await handle(parsed.data as Input<E>)));
      } catch (error) {
        console.error(`[socket] ${event} failed`, error);
        reply(toAck(failure("internal_error", "Something went wrong.")));
      }
    });
  }

  function inRoom<E extends EventName>(
    socket: AppSocket,
    event: E,
    handle: (ctx: RoomCtx, input: Input<E>) => Result<unknown>,
  ) {
    on(socket, event, (input) => {
      const webinarId = socket.data.webinarId;
      const room = webinarId ? rooms.get(webinarId) : undefined;
      if (!room) return failure("not_joined", "Join a webinar first.");
      return handle({ socket, actor: actorOf(socket), room }, input);
    });
  }

  // --- auth ------------------------------------------------------------------

  io.use(async (socket, next) => {
    const token: unknown = socket.handshake.auth?.token;
    if (typeof token !== "string" || token.length === 0 || token.length > 8192) {
      return next(new Error("unauthorized"));
    }
    try {
      socket.data.user = await options.verifyToken(token);
    } catch {
      return next(new Error("unauthorized"));
    }
    socket.data.webinarId = null;
    socket.data.role = null;
    socket.data.lastHeartbeat = Date.now();
    next();
  });

  // --- events ----------------------------------------------------------------

  io.on("connection", (socket) => {
    scheduleExpiry(socket);

    on(socket, C2S.JOIN_WEBINAR, async ({ webinarId }) => {
      const current = socket.data.webinarId;
      if (current && current !== webinarId) {
        return failure("already_joined", "Already in another webinar on this connection.");
      }

      const role = await options.resolveAccess(socket.data.user, webinarId);
      if (!role) return failure("forbidden", "You don't have access to this webinar.");
      if (!socket.connected) return failure("disconnected", "Connection closed.");

      let room = rooms.get(webinarId);
      if (!room) {
        room = new WebinarRoom(webinarId);
        rooms.set(webinarId, room);
      }
      clearTimeout(emptyRoomTimers.get(webinarId));
      emptyRoomTimers.delete(webinarId);

      socket.data.webinarId = webinarId;
      socket.data.role = role;
      await socket.join(roomKey(webinarId));
      if (room.addMember(actorOf(socket), socket.id)) broadcastLiveCount(webinarId);

      return { ok: true, value: room.snapshot(actorOf(socket)) };
    });

    on(socket, C2S.REFRESH_TOKEN, async ({ token }) => {
      let next: AuthUser;
      try {
        next = await options.verifyToken(token);
      } catch {
        return failure("unauthorized", "Invalid token.");
      }
      if (next.id !== socket.data.user.id) return failure("forbidden", "Token belongs to another user.");
      socket.data.user = next;
      scheduleExpiry(socket);
      return { ok: true, value: { expiresAt: new Date(next.expiresAt).toISOString() } };
    });

    on(socket, C2S.HEARTBEAT, () => {
      socket.data.lastHeartbeat = Date.now();
      const room = socket.data.webinarId ? rooms.get(socket.data.webinarId) : undefined;
      return { ok: true, value: { liveCount: room?.liveCount ?? 0, serverTime: new Date().toISOString() } };
    });

    inRoom(socket, C2S.SEND_MESSAGE, ({ socket, actor, room }, { text, clientMessageId }) => {
      const result = room.postMessage(actor, text, clientMessageId);
      if (result.ok) socket.to(roomKey(room.webinarId)).emit(S2C.NEW_MESSAGE, result.value);
      return result;
    });

    inRoom(socket, C2S.SUBMIT_QUESTION, ({ socket, actor, room }, { text }) => {
      const result = room.submitQuestion(actor, text);
      if (!result.ok) return result;
      socket.to(roomKey(room.webinarId)).emit(S2C.NEW_QUESTION, room.viewQuestion(result.value, null));
      return { ok: true, value: room.viewQuestion(result.value, actor.userId) };
    });

    inRoom(socket, C2S.UPVOTE_QUESTION, ({ socket, actor, room }, { questionId }) => {
      const result = room.toggleUpvote(actor, questionId);
      if (!result.ok) return result;
      socket.to(roomKey(room.webinarId)).emit(S2C.QUESTION_UPDATED, room.viewQuestion(result.value, null));
      return { ok: true, value: room.viewQuestion(result.value, actor.userId) };
    });

    inRoom(socket, C2S.CREATE_POLL, ({ socket, actor, room }, { question, options }) => {
      const result = room.createPoll(actor, question, options);
      if (!result.ok) return result;
      socket.to(roomKey(room.webinarId)).emit(S2C.POLL_CREATED, room.viewPoll(result.value, null));
      return { ok: true, value: room.viewPoll(result.value, actor.userId) };
    });

    inRoom(socket, C2S.VOTE, ({ socket, actor, room }, { pollId, optionId }) => {
      const result = room.vote(actor, pollId, optionId);
      if (!result.ok) return result;
      socket.to(roomKey(room.webinarId)).emit(S2C.POLL_RESULTS, room.viewPoll(result.value, null));
      return { ok: true, value: room.viewPoll(result.value, actor.userId) };
    });

    inRoom(socket, C2S.CLOSE_POLL, ({ socket, actor, room }, { pollId }) => {
      const result = room.closePoll(actor, pollId);
      if (!result.ok) return result;
      socket.to(roomKey(room.webinarId)).emit(S2C.POLL_CLOSED, room.viewPoll(result.value, null));
      return { ok: true, value: room.viewPoll(result.value, actor.userId) };
    });

    inRoom(socket, C2S.RAISE_HAND, ({ socket, actor, room }) => {
      const result = room.raiseHand(actor);
      if (result.ok) socket.to(roomKey(room.webinarId)).emit(S2C.HANDRAISE_QUEUE, result.value);
      return result;
    });

    inRoom(socket, C2S.LOWER_HAND, ({ socket, actor, room }, { userId }) => {
      const result = room.lowerHand(actor, userId);
      if (result.ok) socket.to(roomKey(room.webinarId)).emit(S2C.HANDRAISE_QUEUE, result.value);
      return result;
    });

    inRoom(socket, C2S.SEND_REACTION, ({ socket, actor, room }, { emoji }) => {
      const result = room.canReact(actor);
      if (result.ok) {
        socket.to(roomKey(room.webinarId)).emit(S2C.REACTION_RECEIVED, { emoji, userId: actor.userId });
      }
      return result;
    });

    inRoom(socket, C2S.UPDATE_SETTINGS, ({ socket, actor, room }, patch) => {
      const result = room.updateSettings(actor, patch);
      if (result.ok) socket.to(roomKey(room.webinarId)).emit(S2C.SETTINGS_UPDATED, result.value);
      return result;
    });

    inRoom(socket, C2S.ANNOUNCE_STATUS, ({ socket, actor, room }, { status }) => {
      if (actor.role !== "host") return failure("forbidden", "Only the host can do that.");
      socket.to(roomKey(room.webinarId)).emit(S2C.STATUS_CHANGED, { status });
      return { ok: true, value: null };
    });

    socket.on("disconnect", () => {
      clearTimeout(socket.data.expiryTimer);
      leaveRoom(socket);
    });
  });

  // Drop sockets whose client stopped sending heartbeats (e.g. a frozen tab).
  const sweeper = setInterval(() => {
    const cutoff = Date.now() - heartbeatTimeoutMs;
    for (const socket of io.of("/").sockets.values()) {
      if (socket.data.lastHeartbeat < cutoff) socket.disconnect(true);
    }
  }, Math.max(1000, Math.floor(heartbeatTimeoutMs / 3)));
  sweeper.unref();

  return {
    io,
    rooms,
    async close() {
      closing = true;
      clearInterval(sweeper);
      // io.close() fires disconnect handlers, so clear timers afterwards too.
      await io.close();
      for (const timer of [...emptyRoomTimers.values(), ...liveCountTimers.values()]) clearTimeout(timer);
      emptyRoomTimers.clear();
      liveCountTimers.clear();
    },
  };
}
