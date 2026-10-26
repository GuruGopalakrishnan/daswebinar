// Integration tests: real Socket.IO server and clients over WebSocket, with
// stubbed token verification and access checks. Run: npm run test:socket

import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { io as connect, type Socket as ClientSocket } from "socket.io-client";
import { C2S, S2C, type Ack } from "./protocol.ts";
import type { AuthUser } from "./auth.ts";
import { createRealtimeServer } from "./server.ts";

const WEBINAR = "11111111-1111-4111-8111-111111111111";
const OTHER_WEBINAR = "22222222-2222-4222-8222-222222222222";

const USERS: Record<string, { id: string; name: string }> = {
  host: { id: "u-host", name: "Hana Host" },
  alice: { id: "u-alice", name: "Alice" },
  bob: { id: "u-bob", name: "Bob" },
};

// token format: "<user>" or "<user>:<ms until expiry>"
async function verifyToken(token: string): Promise<AuthUser> {
  const [who, ttl] = token.split(":");
  const user = USERS[who ?? ""];
  if (!user) throw new Error("bad token");
  return { ...user, email: `${who}@example.com`, token, expiresAt: Date.now() + Number(ttl ?? 3_600_000) };
}

async function resolveAccess(user: AuthUser, webinarId: string) {
  if (webinarId !== WEBINAR) return null;
  return user.id === USERS.host!.id ? ("host" as const) : ("attendee" as const);
}

let httpServer: HttpServer;
let realtime: ReturnType<typeof createRealtimeServer>;
let url: string;
const clients: ClientSocket[] = [];

async function startServer() {
  httpServer = createServer();
  realtime = createRealtimeServer(httpServer, {
    verifyToken,
    resolveAccess,
    corsOrigin: "http://localhost:3000",
    heartbeatTimeoutMs: 60_000,
  });
  await new Promise<void>((r) => httpServer.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
}

async function stopServer() {
  for (const c of clients.splice(0)) c.disconnect();
  await realtime.close();
  await new Promise((r) => httpServer.close(r));
}

function client(token?: string): Promise<ClientSocket> {
  const socket = connect(url, {
    auth: token === undefined ? {} : { token },
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
  });
  clients.push(socket);
  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

function emit<T = unknown>(socket: ClientSocket, event: string, payload: unknown = {}): Promise<Ack<T>> {
  return socket.timeout(2000).emitWithAck(event, payload);
}

function next<T = unknown>(socket: ClientSocket, event: string, ms = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Resolves true if `event` does NOT arrive within `ms`. */
function silent(socket: ClientSocket, event: string, ms = 300): Promise<boolean> {
  return new Promise((resolve) => {
    const handler = () => resolve(false);
    socket.once(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve(true);
    }, ms);
  });
}

async function joined(token: string) {
  const socket = await client(token);
  const res = await emit(socket, C2S.JOIN_WEBINAR, { webinarId: WEBINAR });
  assert.equal(res.ok, true, JSON.stringify(res));
  return socket;
}

function data<T>(res: Ack<T>): T {
  assert.ok(res.ok, `expected ok, got ${JSON.stringify(res)}`);
  return (res as { ok: true; data: T }).data;
}

function errorCode(res: Ack<unknown>) {
  return res.ok ? null : res.error.code;
}

// ---------------------------------------------------------------------------

describe("auth & access", () => {
  before(startServer);
  after(stopServer);

  test("rejects connections without a token", async () => {
    await assert.rejects(client(), /unauthorized/);
  });

  test("rejects invalid tokens", async () => {
    await assert.rejects(client("mallory"), /unauthorized/);
  });

  test("denies joining a webinar without access", async () => {
    const s = await client("alice");
    assert.equal(errorCode(await emit(s, C2S.JOIN_WEBINAR, { webinarId: OTHER_WEBINAR })), "forbidden");
  });

  test("rejects malformed webinar ids", async () => {
    const s = await client("alice");
    assert.equal(errorCode(await emit(s, C2S.JOIN_WEBINAR, { webinarId: "nope" })), "invalid_payload");
  });

  test("room events require joining first", async () => {
    const s = await client("alice");
    const res = await emit(s, C2S.SEND_MESSAGE, { text: "hi", clientMessageId: "m1" });
    assert.equal(errorCode(res), "not_joined");
  });

  test("join returns a snapshot with role", async () => {
    const s = await client("host");
    const snap = data(await emit<{ role: string; me: { name: string } }>(s, C2S.JOIN_WEBINAR, { webinarId: WEBINAR }));
    assert.equal(snap.role, "host");
    assert.equal(snap.me.name, "Hana Host");
  });

  test("refresh_token rejects a token for a different user", async () => {
    const s = await client("alice");
    assert.equal(errorCode(await emit(s, C2S.REFRESH_TOKEN, { token: "bob" })), "forbidden");
    assert.equal((await emit(s, C2S.REFRESH_TOKEN, { token: "alice" })).ok, true);
  });

  test("expired sessions are notified and disconnected", async () => {
    const s = await client("alice:200");
    const expired = next(s, S2C.SESSION_EXPIRED);
    const disconnected = next(s, "disconnect");
    await expired;
    await disconnected;
  });
});

describe("public chat", () => {
  beforeEach(startServer);
  afterEach(stopServer);

  test("broadcasts to others, acks the sender, not echoed to sender", async () => {
    const alice = await joined("alice");
    const bob = await joined("bob");
    const received = next<{ text: string; author: { name: string } }>(bob, S2C.NEW_MESSAGE);
    const echoed = silent(alice, S2C.NEW_MESSAGE);

    const ack = data(await emit<{ id: string }>(alice, C2S.SEND_MESSAGE, { text: "  hello  ", clientMessageId: "c1" }));
    const msg = await received;
    assert.equal(msg.text, "hello", "text is trimmed");
    assert.equal(msg.author.name, "Alice");
    assert.ok(ack.id);
    assert.equal(await echoed, true);
  });

  test("retries with the same clientMessageId are idempotent", async () => {
    const alice = await joined("alice");
    const a = data(await emit<{ id: string }>(alice, C2S.SEND_MESSAGE, { text: "once", clientMessageId: "dup" }));
    const b = data(await emit<{ id: string }>(alice, C2S.SEND_MESSAGE, { text: "once", clientMessageId: "dup" }));
    assert.equal(a.id, b.id);
  });

  test("validates payloads", async () => {
    const alice = await joined("alice");
    assert.equal(errorCode(await emit(alice, C2S.SEND_MESSAGE, { text: "   ", clientMessageId: "e" })), "invalid_payload");
    assert.equal(errorCode(await emit(alice, C2S.SEND_MESSAGE, { text: "x".repeat(501), clientMessageId: "l" })), "invalid_payload");
    assert.equal(
      errorCode(await emit(alice, C2S.SEND_MESSAGE, { text: "hi", clientMessageId: "x", role: "host" })),
      "invalid_payload",
      "unknown keys are rejected",
    );
  });

  test("rate limits bursts", async () => {
    const alice = await joined("alice");
    const results = [];
    for (let i = 0; i < 6; i++) {
      results.push(await emit(alice, C2S.SEND_MESSAGE, { text: `m${i}`, clientMessageId: `r${i}` }));
    }
    assert.equal(results.filter((r) => r.ok).length, 5);
    assert.equal(errorCode(results[5]!), "rate_limited");
  });

  test("late joiners get recent messages in the snapshot", async () => {
    const alice = await joined("alice");
    await emit(alice, C2S.SEND_MESSAGE, { text: "before bob", clientMessageId: "h1" });
    const bob = await client("bob");
    const snap = data(await emit<{ messages: { text: string }[] }>(bob, C2S.JOIN_WEBINAR, { webinarId: WEBINAR }));
    assert.deepEqual(snap.messages.map((m) => m.text), ["before bob"]);
  });
});

describe("settings", () => {
  beforeEach(startServer);
  afterEach(stopServer);

  test("only the host can update settings", async () => {
    const alice = await joined("alice");
    assert.equal(errorCode(await emit(alice, C2S.UPDATE_SETTINGS, { chatEnabled: false })), "forbidden");
  });

  test("disabling chat blocks attendees but not the host, and is broadcast", async () => {
    const host = await joined("host");
    const alice = await joined("alice");
    const update = next<{ chatEnabled: boolean }>(alice, S2C.SETTINGS_UPDATED);
    data(await emit(host, C2S.UPDATE_SETTINGS, { chatEnabled: false }));
    assert.equal((await update).chatEnabled, false);
    assert.equal(errorCode(await emit(alice, C2S.SEND_MESSAGE, { text: "hi", clientMessageId: "a" })), "chat_disabled");
    assert.equal((await emit(host, C2S.SEND_MESSAGE, { text: "host here", clientMessageId: "h" })).ok, true);
  });

  test("slow mode spaces attendee messages", async () => {
    const host = await joined("host");
    const alice = await joined("alice");
    data(await emit(host, C2S.UPDATE_SETTINGS, { slowModeSeconds: 30 }));
    assert.equal((await emit(alice, C2S.SEND_MESSAGE, { text: "1", clientMessageId: "s1" })).ok, true);
    assert.equal(errorCode(await emit(alice, C2S.SEND_MESSAGE, { text: "2", clientMessageId: "s2" })), "slow_mode");
  });

  test("rejects out-of-range values", async () => {
    const host = await joined("host");
    assert.equal(errorCode(await emit(host, C2S.UPDATE_SETTINGS, { slowModeSeconds: 9999 })), "invalid_payload");
    assert.equal(errorCode(await emit(host, C2S.UPDATE_SETTINGS, {})), "invalid_payload");
  });
});

describe("presence", () => {
  beforeEach(startServer);
  afterEach(stopServer);

  test("live count counts unique users across tabs", async () => {
    await joined("host");
    const alice1 = await joined("alice");
    await joined("alice");
    const hb = data(await emit<{ liveCount: number }>(alice1, C2S.HEARTBEAT));
    assert.equal(hb.liveCount, 2);
  });

  test("roster lists unique members (host first) and updates on join", async () => {
    const alice = await joined("alice");
    const roster = next<{ userId: string; role: string }[]>(alice, S2C.ROSTER, 2000);
    const host = await client("host");
    const snap = data(await emit<{ members: { userId: string }[] }>(host, C2S.JOIN_WEBINAR, { webinarId: WEBINAR }));
    assert.deepEqual(snap.members.map((m) => m.userId), ["u-host", "u-alice"]);
    assert.deepEqual((await roster).map((m) => m.role), ["host", "attendee"]);
  });

  test("only the host can announce status; attendees receive it", async () => {
    const host = await joined("host");
    const alice = await joined("alice");
    assert.equal(errorCode(await emit(alice, C2S.ANNOUNCE_STATUS, { status: "ended" })), "forbidden");
    const changed = next<{ status: string }>(alice, S2C.STATUS_CHANGED);
    data(await emit(host, C2S.ANNOUNCE_STATUS, { status: "ended" }));
    assert.equal((await changed).status, "ended");
  });

  test("live_count is broadcast when someone leaves", async () => {
    const host = await joined("host");
    const bob = await joined("bob");
    await new Promise((r) => setTimeout(r, 400)); // let the join broadcast settle
    const update = next<{ liveCount: number }>(host, S2C.LIVE_COUNT);
    bob.disconnect();
    assert.equal((await update).liveCount, 1);
  });
});

describe("Q&A", () => {
  beforeEach(startServer);
  afterEach(stopServer);

  test("ask, upvote (toggle), and no self-upvotes", async () => {
    const alice = await joined("alice");
    const bob = await joined("bob");
    const incoming = next<{ id: string; text: string }>(bob, S2C.NEW_QUESTION);
    const q = data(await emit<{ id: string }>(alice, C2S.SUBMIT_QUESTION, { text: "When is the replay?" }));
    assert.equal((await incoming).text, "When is the replay?");

    const updated = next<{ upvotes: number }>(alice, S2C.QUESTION_UPDATED);
    const up = data(await emit<{ upvotes: number; upvotedByMe: boolean }>(bob, C2S.UPVOTE_QUESTION, { questionId: q.id }));
    assert.deepEqual([up.upvotes, up.upvotedByMe], [1, true]);
    assert.equal((await updated).upvotes, 1);

    const down = data(await emit<{ upvotes: number }>(bob, C2S.UPVOTE_QUESTION, { questionId: q.id }));
    assert.equal(down.upvotes, 0, "second upvote toggles off");

    assert.equal(errorCode(await emit(alice, C2S.UPVOTE_QUESTION, { questionId: q.id })), "own_question");
    assert.equal(errorCode(await emit(bob, C2S.UPVOTE_QUESTION, { questionId: "missing" })), "not_found");
  });
});

describe("polls", () => {
  beforeEach(startServer);
  afterEach(stopServer);

  test("host creates, attendees vote and change votes, results broadcast, close stops voting", async () => {
    const host = await joined("host");
    const alice = await joined("alice");
    const bob = await joined("bob");

    assert.equal(errorCode(await emit(alice, C2S.CREATE_POLL, { question: "Q?", options: ["a", "b"] })), "forbidden");
    assert.equal(
      errorCode(await emit(host, C2S.CREATE_POLL, { question: "Q?", options: ["Yes", "yes"] })),
      "invalid_payload",
      "duplicate options rejected",
    );

    const created = next<{ id: string }>(alice, S2C.POLL_CREATED);
    type P = { id: string; options: { id: string; votes: number }[]; myVote: string | null };
    const poll = data(await emit<P>(host, C2S.CREATE_POLL, { question: "Ready?", options: ["Yes", "No"] }));
    assert.equal((await created).id, poll.id);
    const [yes, no] = poll.options;

    const results = next<P>(host, S2C.POLL_RESULTS);
    const mine = data(await emit<P>(alice, C2S.VOTE, { pollId: poll.id, optionId: yes!.id }));
    assert.equal(mine.myVote, yes!.id);
    assert.equal((await results).options[0]!.votes, 1);

    await emit(bob, C2S.VOTE, { pollId: poll.id, optionId: yes!.id });
    const changed = data(await emit<P>(bob, C2S.VOTE, { pollId: poll.id, optionId: no!.id }));
    assert.deepEqual(changed.options.map((o) => o.votes), [1, 1], "changing a vote doesn't double count");

    assert.equal(errorCode(await emit(alice, C2S.VOTE, { pollId: poll.id, optionId: "bogus" })), "invalid_option");
    data(await emit(host, C2S.CLOSE_POLL, { pollId: poll.id }));
    assert.equal(errorCode(await emit(alice, C2S.VOTE, { pollId: poll.id, optionId: no!.id })), "poll_closed");
  });
});

describe("hand raise", () => {
  beforeEach(startServer);
  afterEach(stopServer);

  test("raise, permissions on lowering, host lowers, leaving clears", async () => {
    const host = await joined("host");
    const alice = await joined("alice");
    const bob = await joined("bob");
    type Q = { userId: string }[];

    const queue = next<Q>(host, S2C.HANDRAISE_QUEUE);
    data(await emit(alice, C2S.RAISE_HAND));
    assert.deepEqual((await queue).map((h) => h.userId), ["u-alice"]);

    assert.equal(errorCode(await emit(host, C2S.RAISE_HAND)), "forbidden", "hosts don't raise hands");
    assert.equal(errorCode(await emit(bob, C2S.LOWER_HAND, { userId: "u-alice" })), "forbidden");
    assert.deepEqual(data<Q>(await emit(host, C2S.LOWER_HAND, { userId: "u-alice" })), []);

    data(await emit(bob, C2S.RAISE_HAND));
    const cleared = next<Q>(host, S2C.HANDRAISE_QUEUE);
    bob.disconnect();
    assert.deepEqual(await cleared, [], "disconnecting removes the raised hand");
  });
});

describe("reactions", () => {
  beforeEach(startServer);
  afterEach(stopServer);

  test("allowlisted emoji are broadcast; others rejected", async () => {
    const alice = await joined("alice");
    const bob = await joined("bob");
    const got = next<{ emoji: string; userId: string }>(bob, S2C.REACTION_RECEIVED);
    assert.equal((await emit(alice, C2S.SEND_REACTION, { emoji: "🎉" })).ok, true);
    assert.deepEqual(await got, { emoji: "🎉", userId: "u-alice" });
    assert.equal(errorCode(await emit(alice, C2S.SEND_REACTION, { emoji: "<script>" })), "invalid_payload");
  });
});
