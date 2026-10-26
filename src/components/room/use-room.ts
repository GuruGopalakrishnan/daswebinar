"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { connectRealtime, request, type RealtimeSocket } from "@/lib/realtime/client";
import {
  C2S,
  S2C,
  type Ack,
  type Author,
  type BroadcastStatus,
  type ChatMessage,
  type HandRaise,
  type Poll,
  type Question,
  type Reaction,
  type Role,
  type Settings,
  type Snapshot,
} from "../../../server/socket/protocol";

export type ConnectionState = "connecting" | "joined" | "reconnecting" | "unauthorized" | "forbidden" | "error";

export type LocalMessage = ChatMessage & { pending?: boolean; failed?: boolean };

export type ReactionBurst = { id: number; emoji: Reaction };

export type RoomState = {
  connection: ConnectionState;
  error: string | null;
  role: Role | null;
  me: Author | null;
  settings: Settings | null;
  messages: LocalMessage[];
  questions: Question[];
  polls: Poll[];
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
  | { type: "handraises"; queue: HandRaise[] }
  | { type: "live_count"; liveCount: number }
  | { type: "roster"; members: Author[] }
  | { type: "settings"; settings: Settings }
  | { type: "burst"; emoji: Reaction }
  | { type: "burst_done"; id: number }
  | { type: "status"; status: BroadcastStatus };

const initialState: RoomState = {
  connection: "connecting",
  error: null,
  role: null,
  me: null,
  settings: null,
  messages: [],
  questions: [],
  polls: [],
  handRaises: [],
  members: [],
  liveCount: 0,
  bursts: [],
  broadcastStatus: null,
};

let burstSeq = 0;

function upsert<T extends { id: string }>(list: T[], item: T, merge?: (prev: T, next: T) => T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const copy = [...list];
  copy[i] = merge ? merge(copy[i]!, item) : item;
  return copy;
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
        settings: s.settings,
        messages: [...s.messages, ...unconfirmed],
        questions: s.questions,
        polls: s.polls,
        handRaises: s.handRaises,
        members: s.members,
        liveCount: s.liveCount,
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
      // Broadcasts carry upvotedByMe=false; keep our own flag unless this is our ack.
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
    case "handraises":
      return { ...state, handRaises: action.queue };
    case "live_count":
      return { ...state, liveCount: action.liveCount };
    case "roster":
      return { ...state, members: action.members };
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

export type RoomActions = ReturnType<typeof useRoom>["actions"];

export function useRoom(webinarId: string) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef<RealtimeSocket | null>(null);
  const meRef = useRef<Author | null>(null);

  useEffect(() => {
    meRef.current = state.me;
  }, [state.me]);

  useEffect(() => {
    const supabase = createClient();
    const { socket, close } = connectRealtime(supabase);
    socketRef.current = socket;

    async function join() {
      const res = await request<Snapshot>(socket, C2S.JOIN_WEBINAR, { webinarId }).catch(() => null);
      if (!res) return dispatch({ type: "connection", connection: "error", error: "The room didn't respond. Retrying…" });
      if (res.ok) dispatch({ type: "joined", snapshot: res.data });
      else
        dispatch({
          type: "connection",
          connection: res.error.code === "forbidden" ? "forbidden" : "error",
          error: res.error.message,
        });
    }

    // Join on every (re)connect: a new socket has no room membership.
    socket.on("connect", join);
    socket.on("connect_error", (err) => {
      dispatch({
        type: "connection",
        connection: err.message === "unauthorized" ? "unauthorized" : "reconnecting",
        error: err.message === "unauthorized" ? "Your session has expired." : "Can't reach the room server. Retrying…",
      });
    });
    socket.on("disconnect", (reason) => {
      if (reason !== "io client disconnect") dispatch({ type: "connection", connection: "reconnecting" });
    });
    socket.on(S2C.SESSION_EXPIRED, () =>
      dispatch({ type: "connection", connection: "unauthorized", error: "Your session has expired." }),
    );
    socket.on(S2C.NEW_MESSAGE, (message) => dispatch({ type: "message", message }));
    socket.on(S2C.NEW_QUESTION, (question) => dispatch({ type: "question", question }));
    socket.on(S2C.QUESTION_UPDATED, (question) => dispatch({ type: "question", question }));
    socket.on(S2C.POLL_CREATED, (poll) => dispatch({ type: "poll", poll }));
    socket.on(S2C.POLL_RESULTS, (poll) => dispatch({ type: "poll", poll }));
    socket.on(S2C.POLL_CLOSED, (poll) => dispatch({ type: "poll", poll }));
    socket.on(S2C.HANDRAISE_QUEUE, (queue) => dispatch({ type: "handraises", queue }));
    socket.on(S2C.LIVE_COUNT, ({ liveCount }) => dispatch({ type: "live_count", liveCount }));
    socket.on(S2C.ROSTER, (members) => dispatch({ type: "roster", members }));
    socket.on(S2C.SETTINGS_UPDATED, (settings) => dispatch({ type: "settings", settings }));
    socket.on(S2C.REACTION_RECEIVED, ({ emoji }) => dispatch({ type: "burst", emoji }));
    socket.on(S2C.STATUS_CHANGED, ({ status }) => dispatch({ type: "status", status }));

    return () => {
      close();
      socketRef.current = null;
    };
  }, [webinarId]);

  const call = useCallback(async <T,>(event: Parameters<typeof request>[1], payload: unknown): Promise<Ack<T>> => {
    const socket = socketRef.current;
    if (!socket?.connected) return { ok: false, error: { code: "offline", message: "You're offline. Reconnecting…" } };
    try {
      return await request<T>(socket, event, payload);
    } catch {
      return { ok: false, error: { code: "timeout", message: "The room didn't respond. Try again." } };
    }
  }, []);

  const actions = useMemo(
    () => ({
      async sendMessage(text: string, clientMessageId = crypto.randomUUID()) {
        const me = meRef.current;
        if (me) {
          dispatch({
            type: "message",
            message: { id: `local-${clientMessageId}`, clientMessageId, author: me, text, sentAt: new Date().toISOString(), pending: true },
          });
        }
        const res = await call<ChatMessage>(C2S.SEND_MESSAGE, { text, clientMessageId });
        if (res.ok) dispatch({ type: "message", message: res.data });
        else dispatch({ type: "message_failed", clientMessageId });
        return res;
      },
      async ask(text: string) {
        const res = await call<Question>(C2S.SUBMIT_QUESTION, { text });
        if (res.ok) dispatch({ type: "question", question: res.data, mine: true });
        return res;
      },
      async upvote(questionId: string) {
        const res = await call<Question>(C2S.UPVOTE_QUESTION, { questionId });
        if (res.ok) dispatch({ type: "question", question: res.data, mine: true });
        return res;
      },
      async createPoll(question: string, options: string[]) {
        const res = await call<Poll>(C2S.CREATE_POLL, { question, options });
        if (res.ok) dispatch({ type: "poll", poll: res.data, mine: true });
        return res;
      },
      async vote(pollId: string, optionId: string) {
        const res = await call<Poll>(C2S.VOTE, { pollId, optionId });
        if (res.ok) dispatch({ type: "poll", poll: res.data, mine: true });
        return res;
      },
      async closePoll(pollId: string) {
        const res = await call<Poll>(C2S.CLOSE_POLL, { pollId });
        if (res.ok) dispatch({ type: "poll", poll: res.data, mine: true });
        return res;
      },
      async raiseHand() {
        const res = await call<HandRaise[]>(C2S.RAISE_HAND, {});
        if (res.ok) dispatch({ type: "handraises", queue: res.data });
        return res;
      },
      async lowerHand(userId?: string) {
        const res = await call<HandRaise[]>(C2S.LOWER_HAND, userId ? { userId } : {});
        if (res.ok) dispatch({ type: "handraises", queue: res.data });
        return res;
      },
      async react(emoji: Reaction) {
        dispatch({ type: "burst", emoji });
        return call<null>(C2S.SEND_REACTION, { emoji });
      },
      async updateSettings(patch: Partial<Settings>) {
        const res = await call<Settings>(C2S.UPDATE_SETTINGS, patch);
        if (res.ok) dispatch({ type: "settings", settings: res.data });
        return res;
      },
      announce(status: BroadcastStatus) {
        dispatch({ type: "status", status });
        return call<null>(C2S.ANNOUNCE_STATUS, { status });
      },
      burstDone(id: number) {
        dispatch({ type: "burst_done", id });
      },
    }),
    [call],
  );

  return { state, actions };
}
