// In-memory state for one webinar room. No I/O here: handlers.ts translates
// socket events into these calls and broadcasts the results.

import { randomUUID } from "node:crypto";
import {
  DEFAULT_SETTINGS,
  type Author,
  type ChatMessage,
  type HandRaise,
  type Poll,
  type Question,
  type Settings,
  type Snapshot,
} from "./protocol.ts";

export type Actor = Author;
export type Result<T> = { ok: true; value: T } | { ok: false; code: string; message: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (code: string, message: string): Result<never> => ({ ok: false, code, message });

const MAX_MESSAGES = 200;
const MAX_QUESTIONS = 500;
const MAX_POLLS = 20;

type StoredQuestion = Omit<Question, "upvotes" | "upvotedByMe"> & { upvoters: Set<string> };
type StoredPoll = Omit<Poll, "options" | "myVote"> & {
  options: { id: string; text: string }[];
  votes: Map<string, string>; // userId -> optionId
};

export class WebinarRoom {
  readonly webinarId: string;
  settings: Settings = { ...DEFAULT_SETTINGS };

  private readonly messages: ChatMessage[] = [];
  private readonly questions = new Map<string, StoredQuestion>();
  private readonly polls = new Map<string, StoredPoll>();
  private readonly handRaises = new Map<string, HandRaise>();
  private readonly members = new Map<string, { author: Author; sockets: Set<string> }>();
  private readonly lastMessageAt = new Map<string, number>();

  constructor(webinarId: string) {
    this.webinarId = webinarId;
  }

  // --- presence -------------------------------------------------------------

  /** Returns true if the live count changed (first socket for this user). */
  addMember(actor: Actor, socketId: string): boolean {
    const member = this.members.get(actor.userId) ?? { author: actor, sockets: new Set<string>() };
    member.author = actor;
    member.sockets.add(socketId);
    this.members.set(actor.userId, member);
    return member.sockets.size === 1;
  }

  /**
   * `left` is true when this was the user's last socket (live count changed).
   * A user who leaves entirely drops out of the hand-raise queue.
   */
  removeMember(userId: string, socketId: string): { left: boolean; handLowered: boolean } {
    const member = this.members.get(userId);
    if (!member?.sockets.delete(socketId) || member.sockets.size > 0) {
      return { left: false, handLowered: false };
    }
    this.members.delete(userId);
    return { left: true, handLowered: this.handRaises.delete(userId) };
  }

  /** Unique members, host first, then by name. */
  roster(): Author[] {
    return [...this.members.values()]
      .map((m) => m.author)
      .sort((a, b) =>
        a.role === b.role ? a.name.localeCompare(b.name) : a.role === "host" ? -1 : 1,
      );
  }

  /** Unique users, not sockets: several tabs count once. */
  get liveCount() {
    return this.members.size;
  }

  get isEmpty() {
    return this.members.size === 0;
  }

  snapshot(me: Actor): Snapshot {
    return {
      webinarId: this.webinarId,
      role: me.role,
      me,
      settings: { ...this.settings },
      messages: [...this.messages],
      questions: [...this.questions.values()].map((q) => this.viewQuestion(q, me.userId)),
      polls: [...this.polls.values()].map((p) => this.viewPoll(p, me.userId)),
      handRaises: this.handRaiseQueue(),
      liveCount: this.liveCount,
      members: this.roster(),
    };
  }

  // --- chat -----------------------------------------------------------------

  postMessage(actor: Actor, text: string, clientMessageId: string, now = Date.now()): Result<ChatMessage> {
    const isHost = actor.role === "host";
    if (!this.settings.chatEnabled && !isHost) {
      return fail("chat_disabled", "Chat is turned off.");
    }

    // Idempotent retries: the same clientMessageId returns the original.
    const duplicate = this.messages.find(
      (m) => m.author.userId === actor.userId && m.clientMessageId === clientMessageId,
    );
    if (duplicate) return ok(duplicate);

    if (!isHost && this.settings.slowModeSeconds > 0) {
      const last = this.lastMessageAt.get(actor.userId);
      const waitMs = last === undefined ? 0 : last + this.settings.slowModeSeconds * 1000 - now;
      if (waitMs > 0) {
        return fail("slow_mode", `Slow mode: wait ${Math.ceil(waitMs / 1000)}s.`);
      }
    }

    const message: ChatMessage = {
      id: randomUUID(),
      clientMessageId,
      author: actor,
      text,
      sentAt: new Date(now).toISOString(),
    };
    this.messages.push(message);
    if (this.messages.length > MAX_MESSAGES) this.messages.shift();
    this.lastMessageAt.set(actor.userId, now);
    return ok(message);
  }

  // --- Q&A ------------------------------------------------------------------

  submitQuestion(actor: Actor, text: string, now = Date.now()): Result<StoredQuestion> {
    if (!this.settings.qnaEnabled && actor.role !== "host") {
      return fail("qna_disabled", "Q&A is turned off.");
    }
    if (this.questions.size >= MAX_QUESTIONS) {
      return fail("limit_reached", "This session has reached its question limit.");
    }
    const question: StoredQuestion = {
      id: randomUUID(),
      author: actor,
      text,
      askedAt: new Date(now).toISOString(),
      upvoters: new Set(),
    };
    this.questions.set(question.id, question);
    return ok(question);
  }

  /** Toggles the actor's upvote. Authors can't upvote their own question. */
  toggleUpvote(actor: Actor, questionId: string): Result<StoredQuestion> {
    const question = this.questions.get(questionId);
    if (!question) return fail("not_found", "Question not found.");
    if (question.author.userId === actor.userId) {
      return fail("own_question", "You can't upvote your own question.");
    }
    if (!question.upvoters.delete(actor.userId)) question.upvoters.add(actor.userId);
    return ok(question);
  }

  viewQuestion(q: StoredQuestion, viewerId: string | null): Question {
    return {
      id: q.id,
      author: q.author,
      text: q.text,
      askedAt: q.askedAt,
      upvotes: q.upvoters.size,
      upvotedByMe: viewerId !== null && q.upvoters.has(viewerId),
    };
  }

  // --- polls ----------------------------------------------------------------

  createPoll(actor: Actor, question: string, options: string[], now = Date.now()): Result<StoredPoll> {
    if (actor.role !== "host") return fail("forbidden", "Only the host can create polls.");
    if (this.polls.size >= MAX_POLLS) return fail("limit_reached", "Poll limit reached.");
    const poll: StoredPoll = {
      id: randomUUID(),
      question,
      options: options.map((text) => ({ id: randomUUID(), text })),
      createdAt: new Date(now).toISOString(),
      closed: false,
      votes: new Map(),
    };
    this.polls.set(poll.id, poll);
    return ok(poll);
  }

  /** One vote per user; voting again changes the vote. */
  vote(actor: Actor, pollId: string, optionId: string): Result<StoredPoll> {
    const poll = this.polls.get(pollId);
    if (!poll) return fail("not_found", "Poll not found.");
    if (poll.closed) return fail("poll_closed", "This poll is closed.");
    if (!poll.options.some((o) => o.id === optionId)) return fail("invalid_option", "Unknown option.");
    poll.votes.set(actor.userId, optionId);
    return ok(poll);
  }

  closePoll(actor: Actor, pollId: string): Result<StoredPoll> {
    if (actor.role !== "host") return fail("forbidden", "Only the host can close polls.");
    const poll = this.polls.get(pollId);
    if (!poll) return fail("not_found", "Poll not found.");
    poll.closed = true;
    return ok(poll);
  }

  viewPoll(p: StoredPoll, viewerId: string | null): Poll {
    const counts = new Map<string, number>();
    for (const optionId of p.votes.values()) counts.set(optionId, (counts.get(optionId) ?? 0) + 1);
    return {
      id: p.id,
      question: p.question,
      options: p.options.map((o) => ({ ...o, votes: counts.get(o.id) ?? 0 })),
      createdAt: p.createdAt,
      closed: p.closed,
      myVote: viewerId === null ? null : (p.votes.get(viewerId) ?? null),
    };
  }

  // --- hand raise -----------------------------------------------------------

  raiseHand(actor: Actor, now = Date.now()): Result<HandRaise[]> {
    if (actor.role === "host") return fail("forbidden", "Hosts don't raise hands.");
    if (!this.settings.handRaiseEnabled) return fail("handraise_disabled", "Hand raising is turned off.");
    if (!this.handRaises.has(actor.userId)) {
      this.handRaises.set(actor.userId, {
        userId: actor.userId,
        name: actor.name,
        raisedAt: new Date(now).toISOString(),
      });
    }
    return ok(this.handRaiseQueue());
  }

  /** Attendees lower their own hand; the host can lower anyone's. */
  lowerHand(actor: Actor, targetUserId = actor.userId): Result<HandRaise[]> {
    if (targetUserId !== actor.userId && actor.role !== "host") {
      return fail("forbidden", "Only the host can lower someone else's hand.");
    }
    this.handRaises.delete(targetUserId);
    return ok(this.handRaiseQueue());
  }

  handRaiseQueue(): HandRaise[] {
    return [...this.handRaises.values()].sort((a, b) => a.raisedAt.localeCompare(b.raisedAt));
  }

  // --- reactions & settings ---------------------------------------------------

  canReact(actor: Actor): Result<null> {
    if (!this.settings.reactionsEnabled && actor.role !== "host") {
      return fail("reactions_disabled", "Reactions are turned off.");
    }
    return ok(null);
  }

  updateSettings(actor: Actor, patch: Partial<Settings>): Result<Settings> {
    if (actor.role !== "host") return fail("forbidden", "Only the host can change settings.");
    this.settings = { ...this.settings, ...patch };
    return ok({ ...this.settings });
  }
}
