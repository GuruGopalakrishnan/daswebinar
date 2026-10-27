"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { roomRpc } from "@/lib/realtime/client";
import {
  EVENTS,
  REACTION_EVENT,
  reactionsTopic,
  roomTopic,
  type Ack,
  type Author,
  type BroadcastStatus,
  type ChatMessage,
  type HandRaise,
  type Poll,
  type PresenceMeta,
  type Question,
  type Reaction,
  type ReactionPayload,
  REACTIONS,
  type Role,
  type Settings,
  type Snapshot,
} from "@/lib/realtime/protocol";

export type ConnectionState = "connecting" | "joined" | "reconnecting" | "unauthorized" | "forbidden" | "removed" | "error";

export type LocalMessage = ChatMessage & { pending?: boolean; failed?: boolean };

export type ReactionBurst = { id: number; emoji: Reaction };

export type RoomState = {
  connection: ConnectionState;
  error: string | null;
  role: Role | null;
  me: Author | null;
  hostId: string | null;
  settings: Settings | null;
  messages: LocalMessage[];
  questions: Question[];
  polls: Poll[];
  /** One entry per user, from Presence. */
  presence: PresenceMeta[];
  handRaises: HandRaise[];
  members: Author[];
  liveCount: number;
  bursts: ReactionBurst[];
  broadcastStatus: BroadcastStatus | null;
};

type Action =
  | { type: "joined"; snapshot: Snapshot }
  | { type: "connection"; connection: ConnectionState; error?: string | null }
  | { type: "message"; message: LocalMessage }
  | { type: "message_failed"; clientMessageId: string }
  | { type: "question"; question: Question; mine?: boolean }
  | { type: "poll"; poll: Poll; mine?: boolean }
  | { type: "presence"; presence: PresenceMeta[] }
  | { type: "settings"; settings: Settings }
  | { type: "burst"; emoji: Reaction }
  | { type: "burst_done"; id: number }
  | { type: "status"; status: BroadcastStatus };

const initialState: RoomState = {
  connection: "connecting",
  error: null,
  role: null,
  me: null,
  hostId: null,
  settings: null,
  messages: [],
  questions: [],
  polls: [],
  presence: [],
  handRaises: [],
  members: [],
  liveCount: 0,
  bursts: [],
  broadcastStatus: null,
};

const REACTION_LIMIT = { count: 10, windowMs: 5_000 };
/** One reactions message per user per window, whatever the tap rate. */
const REACTION_FLUSH_MS = 1_500;

let burstSeq = 0;

function upsert<T extends { id: string }>(list: T[], item: T, merge?: (prev: T, next: T) => T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const copy = [...list];
  copy[i] = merge ? merge(copy[i]!, item) : item;
  return copy;
}

/** Roster, live count and hand-raise queue, derived from Presence. */
function fromPresence(presence: PresenceMeta[], hostId: string | null) {
  const members: Author[] = presence
    .map((p) => ({ userId: p.userId, name: p.name, role: p.userId === hostId ? ("host" as const) : ("attendee" as const) }))
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "host" ? -1 : 1));
  const handRaises: HandRaise[] = presence
    .filter((p): p is PresenceMeta & { handRaisedAt: string } => p.handRaisedAt !== null && p.userId !== hostId)
    .map((p) => ({ userId: p.userId, name: p.name, raisedAt: p.handRaisedAt }))
    .sort((a, b) => a.raisedAt.localeCompare(b.raisedAt));
  return { members, handRaises, liveCount: members.length };
}

function reducer(state: RoomState, action: Action): RoomState {
  switch (action.type) {
    case "joined": {
      const s = action.snapshot;
      // Keep optimistic messages that the server hasn't confirmed yet.
      const unconfirmed = state.messages.filter(
        (m) => m.pending && !s.messages.some((x) => x.clientMessageId === m.clientMessageId && x.author.userId === m.author.userId),
      );
      return {
        ...state,
        connection: "joined",
        error: null,
        role: s.role,
        me: s.me,
        hostId: s.hostId,
        settings: s.settings,
        messages: [...s.messages, ...unconfirmed],
        questions: s.questions,
        polls: s.polls,
        ...fromPresence(state.presence, s.hostId),
      };
    }
    case "connection":
      return { ...state, connection: action.connection, error: action.error ?? state.error };
    case "message": {
      const m = action.message;
      const i = state.messages.findIndex(
        (x) => x.id === m.id || (x.clientMessageId === m.clientMessageId && x.author.userId === m.author.userId),
      );
      if (i === -1) return { ...state, messages: [...state.messages, m].slice(-300) };
      const copy = [...state.messages];
      copy[i] = m;
      return { ...state, messages: copy };
    }
    case "message_failed":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.clientMessageId === action.clientMessageId && m.author.userId === state.me?.userId
            ? { ...m, pending: false, failed: true }
            : m,
        ),
      };
    case "question":
      // Broadcasts carry upvotedByMe=false; keep our own flag unless this is our result.
      return {
        ...state,
        questions: upsert(state.questions, action.question, (prev, next) =>
          action.mine ? next : { ...next, upvotedByMe: prev.upvotedByMe },
        ),
      };
    case "poll":
      return {
        ...state,
        polls: upsert(state.polls, action.poll, (prev, next) => (action.mine ? next : { ...next, myVote: prev.myVote })),
      };
    case "presence":
      return { ...state, presence: action.presence, ...fromPresence(action.presence, state.hostId) };
    case "settings":
      return { ...state, settings: action.settings };
    case "burst":
      return { ...state, bursts: [...state.bursts.slice(-24), { id: ++burstSeq, emoji: action.emoji }] };
    case "burst_done":
      return { ...state, bursts: state.bursts.filter((b) => b.id !== action.id) };
    case "status":
      return { ...state, broadcastStatus: action.status };
  }
}

/** `channel()` returns an existing channel for the same topic, so wait for an old one to go. */
async function freshChannel(supabase: SupabaseClient, topic: string, config: Parameters<SupabaseClient["channel"]>[1]) {
  const stale = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`);
  if (stale) await supabase.removeChannel(stale);
  return supabase.channel(topic, config);
}

const fail = (code: string, message: string): Ack<never> => ({ ok: false, error: { code, message } });

export type RoomActions = ReturnType<typeof useRoom>["actions"];

export function useRoom(webinarId: string) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const supabase = useMemo(() => createClient(), []);
  const roomRef = useRef<RealtimeChannel | null>(null);
  const reactionsRef = useRef<RealtimeChannel | null>(null);
  const stateRef = useRef(state);
  /** What we track in Presence; re-sent after every (re)join. */
  const presenceRef = useRef<PresenceMeta | null>(null);
  const reactionTimes = useRef<number[]>([]);
  const pendingReactions = useRef<Partial<Record<Reaction, number>>>({});
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const track = useCallback(async (patch: Partial<PresenceMeta>) => {
    if (!presenceRef.current) return;
    presenceRef.current = { ...presenceRef.current, ...patch };
    await roomRef.current?.track(presenceRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channels: RealtimeChannel[] = [];

    async function join(room: RealtimeChannel) {
      const res = await roomRpc<Snapshot>(supabase, "get_room_snapshot", { p_webinar_id: webinarId });
      if (cancelled) return;
      if (!res.ok) {
        dispatch({
          type: "connection",
          connection: res.error.code === "forbidden" ? "forbidden" : "error",
          error: res.error.message,
        });
        return;
      }
      dispatch({ type: "joined", snapshot: res.data });
      const { me, settings } = res.data;
      presenceRef.current = {
        userId: me.userId,
        name: me.name,
        // Keep a raised hand across reconnects, unless hand raising was turned off meanwhile.
        handRaisedAt: settings.handRaiseEnabled ? (presenceRef.current?.handRaisedAt ?? null) : null,
      };
      await room.track(presenceRef.current);
    }

    async function start() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (cancelled) return;
      if (!user) {
        dispatch({ type: "connection", connection: "unauthorized", error: "Your session has expired." });
        return;
      }
      // Private channels authorize with the user's access token.
      await supabase.realtime.setAuth();

      const room = await freshChannel(supabase, roomTopic(webinarId), {
        config: { private: true, presence: { key: user.id, enabled: true } },
      });
      const reactions = await freshChannel(supabase, reactionsTopic(webinarId), {
        config: { private: true, broadcast: { self: false } },
      });
      if (cancelled) {
        void supabase.removeChannel(room);
        void supabase.removeChannel(reactions);
        return;
      }
      channels = [room, reactions];
      roomRef.current = room;
      reactionsRef.current = reactions;

      room
        .on("broadcast", { event: EVENTS.NEW_MESSAGE }, ({ payload }) => dispatch({ type: "message", message: payload as ChatMessage }))
        .on("broadcast", { event: EVENTS.NEW_QUESTION }, ({ payload }) => dispatch({ type: "question", question: payload as Question }))
        .on("broadcast", { event: EVENTS.QUESTION_UPDATED }, ({ payload }) => dispatch({ type: "question", question: payload as Question }))
        .on("broadcast", { event: EVENTS.POLL_CREATED }, ({ payload }) => dispatch({ type: "poll", poll: payload as Poll }))
        .on("broadcast", { event: EVENTS.POLL_RESULTS }, ({ payload }) => dispatch({ type: "poll", poll: payload as Poll }))
        .on("broadcast", { event: EVENTS.POLL_CLOSED }, ({ payload }) => dispatch({ type: "poll", poll: payload as Poll }))
        .on("broadcast", { event: EVENTS.STATUS_CHANGED }, ({ payload }) =>
          dispatch({ type: "status", status: (payload as { status: BroadcastStatus }).status }),
        )
        .on("broadcast", { event: EVENTS.SETTINGS_UPDATED }, ({ payload }) => {
          const settings = payload as Settings;
          dispatch({ type: "settings", settings });
          if (!settings.handRaiseEnabled && presenceRef.current?.handRaisedAt) void track({ handRaisedAt: null });
        })
        .on("broadcast", { event: EVENTS.LOWER_HAND }, ({ payload }) => {
          if ((payload as { userId: string }).userId === presenceRef.current?.userId) void track({ handRaisedAt: null });
        })
        .on("broadcast", { event: EVENTS.ATTENDEE_REMOVED }, ({ payload }) => {
          if ((payload as { userId: string }).userId !== presenceRef.current?.userId) return;
          dispatch({ type: "connection", connection: "removed", error: "The host removed you from this webinar." });
          for (const channel of channels) void supabase.removeChannel(channel);
        })
        .on("presence", { event: "sync" }, () => {
          // Several tabs share one key (the user id), so each user counts once.
          const presence = Object.values(room.presenceState<PresenceMeta>())
            .map((metas) => metas[0])
            .filter((m): m is NonNullable<typeof m> => m !== undefined)
            .map(({ userId, name, handRaisedAt }) => ({ userId, name, handRaisedAt }));
          dispatch({ type: "presence", presence });
        })
        .subscribe((status, err) => {
          if (cancelled) return;
          // Re-fetch on every (re)subscribe: broadcasts sent while we were away are gone.
          if (status === "SUBSCRIBED") void join(room);
          else if (status === "CHANNEL_ERROR" && err && /unauthori[sz]ed|permission|expired/i.test(err.message)) {
            const expired = /expired/i.test(err.message);
            dispatch({
              type: "connection",
              connection: expired ? "unauthorized" : "forbidden",
              error: expired ? "Your session has expired." : "You don't have access to this webinar.",
            });
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            dispatch({ type: "connection", connection: "reconnecting", error: "Can't reach the room. Retrying…" });
          }
        });

      reactions
        .on("broadcast", { event: REACTION_EVENT }, ({ payload }) => {
          const { counts, userId } = payload as ReactionPayload;
          const { settings, hostId } = stateRef.current;
          // Clients enforce the setting on receive; only the host may react while it's off.
          if (settings && !settings.reactionsEnabled && userId !== hostId) return;
          if (!counts || typeof counts !== "object") return;
          for (const emoji of REACTIONS) {
            const n = Math.min(3, Math.max(0, Math.floor(Number(counts[emoji] ?? 0))));
            for (let i = 0; i < n; i++) dispatch({ type: "burst", emoji });
          }
        })
        .subscribe();
    }

    const { data: auth } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        dispatch({ type: "connection", connection: "unauthorized", error: "Your session has expired." });
        for (const channel of channels) void supabase.removeChannel(channel);
      }
    });

    void start();

    return () => {
      cancelled = true;
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = null;
      pendingReactions.current = {};
      auth.subscription.unsubscribe();
      for (const channel of channels) void supabase.removeChannel(channel);
      roomRef.current = null;
      reactionsRef.current = null;
    };
  }, [supabase, webinarId, track]);

  const actions = useMemo(
    () => ({
      async sendMessage(text: string, clientMessageId: string = crypto.randomUUID()) {
        const me = stateRef.current.me;
        if (me) {
          dispatch({
            type: "message",
            message: { id: `local-${clientMessageId}`, clientMessageId, author: me, text, sentAt: new Date().toISOString(), pending: true },
          });
        }
        const res = await roomRpc<ChatMessage>(supabase, "send_room_message", {
          p_webinar_id: webinarId,
          p_text: text,
          p_client_message_id: clientMessageId,
        });
        if (res.ok) dispatch({ type: "message", message: res.data });
        else dispatch({ type: "message_failed", clientMessageId });
        return res;
      },
      async ask(text: string) {
        const res = await roomRpc<Question>(supabase, "ask_question", { p_webinar_id: webinarId, p_text: text });
        if (res.ok) dispatch({ type: "question", question: res.data, mine: true });
        return res;
      },
      async upvote(questionId: string) {
        const res = await roomRpc<Question>(supabase, "toggle_question_upvote", { p_question_id: questionId });
        if (res.ok) dispatch({ type: "question", question: res.data, mine: true });
        return res;
      },
      async createPoll(question: string, options: string[]) {
        const res = await roomRpc<Poll>(supabase, "create_poll", {
          p_webinar_id: webinarId,
          p_question: question,
          p_options: options,
        });
        if (res.ok) dispatch({ type: "poll", poll: res.data, mine: true });
        return res;
      },
      async vote(pollId: string, optionId: string) {
        const res = await roomRpc<Poll>(supabase, "vote_poll", { p_poll_id: pollId, p_option_id: optionId });
        if (res.ok) dispatch({ type: "poll", poll: res.data, mine: true });
        return res;
      },
      async closePoll(pollId: string) {
        const res = await roomRpc<Poll>(supabase, "close_poll", { p_poll_id: pollId });
        if (res.ok) dispatch({ type: "poll", poll: res.data, mine: true });
        return res;
      },
      async raiseHand(): Promise<Ack<null>> {
        const { role, settings } = stateRef.current;
        if (role === "host") return fail("forbidden", "Hosts don't raise hands.");
        if (!settings?.handRaiseEnabled) return fail("handraise_disabled", "Hand raising is turned off.");
        if (!presenceRef.current) return fail("offline", "You're offline. Reconnecting…");
        if (!presenceRef.current.handRaisedAt) await track({ handRaisedAt: new Date().toISOString() });
        return { ok: true, data: null };
      },
      /** Lowers your own hand, or (host only) someone else's. */
      async lowerHand(userId?: string): Promise<Ack<null>> {
        if (!userId || userId === presenceRef.current?.userId) {
          await track({ handRaisedAt: null });
          return { ok: true, data: null };
        }
        return roomRpc<null>(supabase, "lower_room_hand", { p_webinar_id: webinarId, p_user_id: userId });
      },
      async react(emoji: Reaction): Promise<Ack<null>> {
        const { role, settings, me } = stateRef.current;
        if (settings && !settings.reactionsEnabled && role !== "host") {
          return fail("reactions_disabled", "Reactions are turned off.");
        }
        const now = Date.now();
        const recent = reactionTimes.current.filter((t) => now - t < REACTION_LIMIT.windowMs);
        if (recent.length >= REACTION_LIMIT.count) return fail("rate_limited", "Slow down.");
        reactionTimes.current = [...recent, now];

        dispatch({ type: "burst", emoji });
        pendingReactions.current[emoji] = (pendingReactions.current[emoji] ?? 0) + 1;
        flushTimer.current ??= setTimeout(() => {
          flushTimer.current = null;
          const counts = pendingReactions.current;
          pendingReactions.current = {};
          void reactionsRef.current?.send({
            type: "broadcast",
            event: REACTION_EVENT,
            payload: { counts, userId: me?.userId ?? "" } satisfies ReactionPayload,
          });
        }, REACTION_FLUSH_MS);
        return { ok: true, data: null };
      },
      async removeAttendee(userId: string) {
        return roomRpc<null>(supabase, "remove_room_attendee", { p_webinar_id: webinarId, p_user_id: userId });
      },
      async setAnswered(questionId: string, answered: boolean) {
        const res = await roomRpc<Question>(supabase, "set_question_answered", { p_question_id: questionId, p_answered: answered });
        if (res.ok) dispatch({ type: "question", question: res.data, mine: true });
        return res;
      },
      async updateSettings(patch: Partial<Settings>) {
        const res = await roomRpc<Settings>(supabase, "update_room_settings", { p_webinar_id: webinarId, p_settings: patch });
        if (res.ok) dispatch({ type: "settings", settings: res.data });
        return res;
      },
      /**
       * Updates the host's view right away. Everyone else hears about it from
       * the database, which broadcasts status changes made by start/end.
       */
      async announce(status: BroadcastStatus): Promise<Ack<null>> {
        dispatch({ type: "status", status });
        return { ok: true, data: null };
      },
      burstDone(id: number) {
        dispatch({ type: "burst_done", id });
      },
    }),
    [supabase, webinarId, track],
  );

  return { state, actions };
}
