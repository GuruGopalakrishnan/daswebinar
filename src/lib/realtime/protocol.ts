// Live-room protocol on Supabase Realtime. JSON shapes match the functions in
// supabase/migrations/20261026030000_realtime_room.sql.

export type Role = "host" | "attendee";

export type Settings = {
  chatEnabled: boolean;
  qnaEnabled: boolean;
  reactionsEnabled: boolean;
  handRaiseEnabled: boolean;
  /** Minimum seconds between chat messages per attendee (0 = off). */
  slowModeSeconds: number;
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

/** get_room_snapshot(). Presence supplies the live count, roster and hand raises. */
export type Snapshot = {
  webinarId: string;
  role: Role;
  hostId: string;
  me: Author;
  settings: Settings;
  messages: ChatMessage[];
  questions: Question[];
  polls: Poll[];
};

/** What each client tracks on the room channel (presence key = userId). */
export type PresenceMeta = {
  userId: string;
  name: string;
  /** ISO time the hand went up, or null. */
  handRaisedAt: string | null;
};

export type BroadcastStatus = "live" | "ended";

export type AckError = { code: string; message: string };
export type Ack<T> = { ok: true; data: T } | { ok: false; error: AckError };

// ---------------------------------------------------------------------------
// Channels and events
// ---------------------------------------------------------------------------

/** Database-only broadcasts + presence. Clients can't send broadcasts here. */
export const roomTopic = (webinarId: string) => `room:${webinarId}`;
/** Client-to-client broadcasts (reactions). */
export const reactionsTopic = (webinarId: string) => `room:${webinarId}:reactions`;

/** Broadcast event names on the room topic (sent by the database). */
export const EVENTS = {
  NEW_MESSAGE: "public_chat:new_message",
  STATUS_CHANGED: "webinar:status_changed",
  NEW_QUESTION: "qna:new_question",
  /** upvotedByMe is false in broadcasts; use the RPC result for your own state. */
  QUESTION_UPDATED: "qna:question_updated",
  POLL_CREATED: "poll:poll_created",
  POLL_RESULTS: "poll:results",
  POLL_CLOSED: "poll:closed",
  LOWER_HAND: "handraise:lower_hand",
  SETTINGS_UPDATED: "webinar_settings:settings_updated",
} as const;

/** Broadcast event on the reactions topic (sent by clients). */
export const REACTION_EVENT = "reaction:reaction_received";
export type ReactionPayload = { emoji: Reaction; userId: string };
