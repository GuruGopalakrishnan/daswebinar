// Realtime protocol shared by the Socket.IO server and the Next.js client.
// Event names follow the `namespace:action` convention. Every client→server
// event takes an ack callback that receives an Ack<T>.
//
// Keep this file free of Node-only imports: the browser bundle imports it.

import { z } from "zod";

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type Role = "host" | "attendee";

export type Settings = {
  chatEnabled: boolean;
  qnaEnabled: boolean;
  reactionsEnabled: boolean;
  handRaiseEnabled: boolean;
  /** Minimum seconds between chat messages per attendee (0 = off). */
  slowModeSeconds: number;
};

export const DEFAULT_SETTINGS: Settings = {
  chatEnabled: true,
  qnaEnabled: true,
  reactionsEnabled: true,
  handRaiseEnabled: true,
  slowModeSeconds: 0,
};

export type Author = { userId: string; name: string; role: Role };

export type ChatMessage = {
  id: string;
  clientMessageId: string;
  author: Author;
  text: string;
  sentAt: string;
};

export type Question = {
  id: string;
  author: Author;
  text: string;
  askedAt: string;
  upvotes: number;
  upvotedByMe: boolean;
};

export type Poll = {
  id: string;
  question: string;
  options: { id: string; text: string; votes: number }[];
  createdAt: string;
  closed: boolean;
  myVote: string | null;
};

export type HandRaise = { userId: string; name: string; raisedAt: string };

export const REACTIONS = ["👍", "❤️", "😂", "🎉", "👏", "🔥", "😮", "🙏"] as const;
export type Reaction = (typeof REACTIONS)[number];

export type Snapshot = {
  webinarId: string;
  role: Role;
  me: Author;
  settings: Settings;
  messages: ChatMessage[];
  questions: Question[];
  polls: Poll[];
  handRaises: HandRaise[];
  liveCount: number;
  /** Unique users currently in the room, host first. */
  members: Author[];
};

export type BroadcastStatus = "live" | "ended";

export type AckError = { code: string; message: string };
export type Ack<T> = { ok: true; data: T } | { ok: false; error: AckError };

// ---------------------------------------------------------------------------
// Event names
// ---------------------------------------------------------------------------

export const C2S = {
  JOIN_WEBINAR: "connection:join_webinar",
  REFRESH_TOKEN: "connection:refresh_token",
  SEND_MESSAGE: "public_chat:send_message",
  HEARTBEAT: "user_session:heartbeat",
  SUBMIT_QUESTION: "qna:submit_question",
  UPVOTE_QUESTION: "qna:upvote_question",
  CREATE_POLL: "poll:create_poll",
  VOTE: "poll:vote",
  CLOSE_POLL: "poll:close_poll",
  RAISE_HAND: "handraise:raise_hand",
  LOWER_HAND: "handraise:lower_hand",
  SEND_REACTION: "reaction:send_reaction",
  UPDATE_SETTINGS: "webinar_settings:update_settings",
  ANNOUNCE_STATUS: "webinar:announce_status",
} as const;

export const S2C = {
  NEW_MESSAGE: "public_chat:new_message",
  LIVE_COUNT: "user_session:live_count",
  ROSTER: "user_session:roster_updated",
  STATUS_CHANGED: "webinar:status_changed",
  NEW_QUESTION: "qna:new_question",
  QUESTION_UPDATED: "qna:question_updated",
  POLL_CREATED: "poll:poll_created",
  POLL_RESULTS: "poll:results",
  POLL_CLOSED: "poll:closed",
  HANDRAISE_QUEUE: "handraise:queue_updated",
  REACTION_RECEIVED: "reaction:reaction_received",
  SETTINGS_UPDATED: "webinar_settings:settings_updated",
  SESSION_EXPIRED: "connection:session_expired",
} as const;

// ---------------------------------------------------------------------------
// Payload schemas (validated on the server)
// ---------------------------------------------------------------------------

const id = z.string().min(1).max(64);
// Strip control characters other than newline/tab; clients render as text.
const text = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").trim())
    .pipe(z.string().min(1).max(max));

export const schemas = {
  [C2S.JOIN_WEBINAR]: z.object({ webinarId: z.uuid() }).strict(),
  [C2S.REFRESH_TOKEN]: z.object({ token: z.string().min(1).max(8192) }).strict(),
  [C2S.SEND_MESSAGE]: z.object({ text: text(500), clientMessageId: id }).strict(),
  [C2S.HEARTBEAT]: z.object({}).strict(),
  [C2S.SUBMIT_QUESTION]: z.object({ text: text(300) }).strict(),
  [C2S.UPVOTE_QUESTION]: z.object({ questionId: id }).strict(),
  [C2S.CREATE_POLL]: z
    .object({
      question: text(200),
      options: z.array(text(100)).min(2).max(6),
    })
    .strict()
    .refine((p) => new Set(p.options.map((o) => o.toLowerCase())).size === p.options.length, {
      message: "Poll options must be unique.",
    }),
  [C2S.VOTE]: z.object({ pollId: id, optionId: id }).strict(),
  [C2S.CLOSE_POLL]: z.object({ pollId: id }).strict(),
  [C2S.RAISE_HAND]: z.object({}).strict(),
  [C2S.LOWER_HAND]: z.object({ userId: id.optional() }).strict(),
  [C2S.SEND_REACTION]: z.object({ emoji: z.enum(REACTIONS) }).strict(),
  [C2S.UPDATE_SETTINGS]: z
    .object({
      chatEnabled: z.boolean(),
      qnaEnabled: z.boolean(),
      reactionsEnabled: z.boolean(),
      handRaiseEnabled: z.boolean(),
      slowModeSeconds: z.int().min(0).max(300),
    })
    .partial()
    .strict()
    .refine((s) => Object.keys(s).length > 0, "Provide at least one setting."),
  // The host announces after the REST lifecycle call succeeds; the database
  // remains the source of truth.
  [C2S.ANNOUNCE_STATUS]: z.object({ status: z.enum(["live", "ended"]) }).strict(),
} as const;

export type Payload<E extends keyof typeof schemas> = z.input<(typeof schemas)[E]>;

// ---------------------------------------------------------------------------
// Typed Socket.IO maps
// ---------------------------------------------------------------------------

type Req<E extends keyof typeof schemas, R> = (payload: Payload<E>, ack: (res: Ack<R>) => void) => void;

export interface ClientToServerEvents {
  [C2S.JOIN_WEBINAR]: Req<typeof C2S.JOIN_WEBINAR, Snapshot>;
  [C2S.REFRESH_TOKEN]: Req<typeof C2S.REFRESH_TOKEN, { expiresAt: string }>;
  [C2S.SEND_MESSAGE]: Req<typeof C2S.SEND_MESSAGE, ChatMessage>;
  [C2S.HEARTBEAT]: Req<typeof C2S.HEARTBEAT, { liveCount: number; serverTime: string }>;
  [C2S.SUBMIT_QUESTION]: Req<typeof C2S.SUBMIT_QUESTION, Question>;
  [C2S.UPVOTE_QUESTION]: Req<typeof C2S.UPVOTE_QUESTION, Question>;
  [C2S.CREATE_POLL]: Req<typeof C2S.CREATE_POLL, Poll>;
  [C2S.VOTE]: Req<typeof C2S.VOTE, Poll>;
  [C2S.CLOSE_POLL]: Req<typeof C2S.CLOSE_POLL, Poll>;
  [C2S.RAISE_HAND]: Req<typeof C2S.RAISE_HAND, HandRaise[]>;
  [C2S.LOWER_HAND]: Req<typeof C2S.LOWER_HAND, HandRaise[]>;
  [C2S.SEND_REACTION]: Req<typeof C2S.SEND_REACTION, null>;
  [C2S.UPDATE_SETTINGS]: Req<typeof C2S.UPDATE_SETTINGS, Settings>;
  [C2S.ANNOUNCE_STATUS]: Req<typeof C2S.ANNOUNCE_STATUS, null>;
}

export interface ServerToClientEvents {
  [S2C.NEW_MESSAGE]: (message: ChatMessage) => void;
  [S2C.LIVE_COUNT]: (payload: { liveCount: number }) => void;
  [S2C.ROSTER]: (members: Author[]) => void;
  [S2C.STATUS_CHANGED]: (payload: { status: BroadcastStatus }) => void;
  [S2C.NEW_QUESTION]: (question: Question) => void;
  /** upvotedByMe is false in broadcasts; use the ack for your own state. */
  [S2C.QUESTION_UPDATED]: (question: Question) => void;
  [S2C.POLL_CREATED]: (poll: Poll) => void;
  [S2C.POLL_RESULTS]: (poll: Poll) => void;
  [S2C.POLL_CLOSED]: (poll: Poll) => void;
  [S2C.HANDRAISE_QUEUE]: (queue: HandRaise[]) => void;
  [S2C.REACTION_RECEIVED]: (payload: { emoji: Reaction; userId: string }) => void;
  [S2C.SETTINGS_UPDATED]: (settings: Settings) => void;
  [S2C.SESSION_EXPIRED]: () => void;
}
