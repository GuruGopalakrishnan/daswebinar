"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useMounted } from "@/hooks/use-client-values";
import { ChatPanel } from "@/components/room/chat-panel";
import { Dock, MobilePanelNav, type Panel } from "@/components/room/dock";
import { PeoplePanel } from "@/components/room/people-panel";
import { PollOverlay } from "@/components/room/poll-overlay";
import { PollsPanel } from "@/components/room/polls-panel";
import { QnaPanel } from "@/components/room/qna-panel";
import { RoomDrawer, RoomOverlay, RoomTopBar } from "@/components/room/room-chrome";
import { Stage } from "@/components/room/stage";
import type { Broadcast } from "@/components/room/use-broadcast";
import { useLocalMedia } from "@/components/room/use-local-media";
import type { LocalMessage, RoomActions } from "@/components/room/use-room";
import type { Ack, Author, HandRaise, Poll, Question, Settings } from "@/lib/realtime/protocol";

export type RoomPreviewProps = {
  isHost: boolean;
  state: "waiting" | "live" | "ended" | "removed";
  panel: Panel | null;
  /** Empty panels (no messages, questions or polls). */
  empty: boolean;
  /** Server request time, so sample timestamps render the same on server and client. */
  now: number;
};

const WEBINAR_ID = "00000000-0000-0000-0000-000000000001";
const HOST: Author = { userId: "sample-host", name: "Ananya Rao", role: "host" };
const ATTENDEES: Author[] = [
  { userId: "sample-a1", name: "Priya Sharma", role: "attendee" },
  { userId: "sample-a2", name: "Karthik Menon", role: "attendee" },
  { userId: "sample-a3", name: "Divya Iyer", role: "attendee" },
  { userId: "sample-a4", name: "Rahul Verma", role: "attendee" },
];

const ok = <T,>(data: T): Promise<Ack<T>> => Promise.resolve({ ok: true, data });

/**
 * Dev preview of the live room. Everything here is SAMPLE data; actions only change local state.
 * Client-only, like the real studio (it mounts after the pre-join click), because device support
 * such as screen sharing is only known in the browser.
 */
export function RoomPreview(props: RoomPreviewProps) {
  const mounted = useMounted();
  if (!mounted) return <div className="dark h-dvh bg-stage" />;
  return <PreviewRoom {...props} />;
}

function PreviewRoom({ isHost, state, panel: initialPanel, empty, now }: RoomPreviewProps) {
  const media = useLocalMedia();
  const me = isHost ? HOST : ATTENDEES[0]!;
  const iso = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();

  const [panel, setPanel] = useState<Panel | null>(initialPanel);
  const [settings, setSettings] = useState<Settings>({
    chatEnabled: true,
    qnaEnabled: true,
    reactionsEnabled: true,
    handRaiseEnabled: true,
    slowModeSeconds: 0,
    recording: isHost && state === "live",
    spotlightQuestionId: null,
  });
  const [messages, setMessages] = useState<LocalMessage[]>(() =>
    empty
      ? []
      : [
          { id: "m1", clientMessageId: "c1", author: HOST, text: "Welcome everyone! We'll start in a minute.", sentAt: iso(9) },
          { id: "m2", clientMessageId: "c2", author: ATTENDEES[1]!, text: "Hi from Chennai 👋", sentAt: iso(8) },
          { id: "m3", clientMessageId: "c3", author: ATTENDEES[1]!, text: "Audio is clear.", sentAt: iso(8) },
          { id: "m4", clientMessageId: "c4", author: ATTENDEES[2]!, text: "Will the slides be shared after the session?", sentAt: iso(5) },
          { id: "m5", clientMessageId: "c5", author: ATTENDEES[0]!, text: "Excited for this one!", sentAt: iso(2) },
        ],
  );
  const [questions, setQuestions] = useState<Question[]>(() =>
    empty
      ? []
      : [
          { id: "q1", author: ATTENDEES[2]!, text: "How many emails should the follow-up sequence have for a cold audience?", askedAt: iso(6), answeredAt: null, upvotes: 7, upvotedByMe: true },
          { id: "q2", author: ATTENDEES[3]!, text: "Does this work for one-to-one coaching or only group programs?", askedAt: iso(4), answeredAt: null, upvotes: 3, upvotedByMe: false },
          { id: "q3", author: ATTENDEES[1]!, text: "Which booking tool do you use?", askedAt: iso(12), answeredAt: iso(3), upvotes: 2, upvotedByMe: false },
        ],
  );
  const [polls, setPolls] = useState<Poll[]>(() =>
    empty
      ? []
      : [
          {
            id: "p1",
            question: "Where do most of your leads come from today?",
            options: [
              { id: "o1", text: "Instagram", votes: 18 },
              { id: "o2", text: "Referrals", votes: 9 },
              { id: "o3", text: "YouTube", votes: 6 },
            ],
            createdAt: iso(1),
            closed: false,
            myVote: null,
          },
          {
            id: "p0",
            question: "Have you run a webinar before?",
            options: [
              { id: "o4", text: "Yes", votes: 11 },
              { id: "o5", text: "Not yet", votes: 24 },
            ],
            createdAt: iso(7),
            closed: true,
            myVote: isHost ? null : "o5",
          },
        ],
  );
  const [hands, setHands] = useState<HandRaise[]>(() =>
    empty ? [] : [{ userId: ATTENDEES[3]!.userId, name: ATTENDEES[3]!.name, raisedAt: iso(1) }],
  );

  const actions = useMemo(() => {
    const a = {
      async sendMessage(text: string, clientMessageId: string = crypto.randomUUID()) {
        const message = { id: clientMessageId, clientMessageId, author: me, text, sentAt: new Date().toISOString() };
        setMessages((m) => [...m, message]);
        return ok(message);
      },
      async ask(text: string) {
        const q: Question = { id: crypto.randomUUID(), author: me, text, askedAt: new Date().toISOString(), answeredAt: null, upvotes: 0, upvotedByMe: false };
        setQuestions((qs) => [...qs, q]);
        return ok(q);
      },
      async upvote(id: string) {
        setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, upvotedByMe: !q.upvotedByMe, upvotes: q.upvotes + (q.upvotedByMe ? -1 : 1) } : q)));
        return ok(null);
      },
      async createPoll(question: string, options: string[]) {
        const poll: Poll = {
          id: crypto.randomUUID(),
          question,
          options: options.map((text) => ({ id: crypto.randomUUID(), text, votes: 0 })),
          createdAt: new Date().toISOString(),
          closed: false,
          myVote: null,
        };
        setPolls((ps) => [poll, ...ps]);
        return ok(poll);
      },
      async vote(pollId: string, optionId: string) {
        setPolls((ps) =>
          ps.map((p) =>
            p.id !== pollId
              ? p
              : {
                  ...p,
                  myVote: optionId,
                  options: p.options.map((o) => ({ ...o, votes: o.votes + (o.id === optionId ? 1 : 0) - (o.id === p.myVote ? 1 : 0) })),
                },
          ),
        );
        return ok(null);
      },
      async closePoll(pollId: string) {
        setPolls((ps) => ps.map((p) => (p.id === pollId ? { ...p, closed: true } : p)));
        return ok(null);
      },
      async raiseHand() {
        setHands((h) => [...h, { userId: me.userId, name: me.name, raisedAt: new Date().toISOString() }]);
        return ok(null);
      },
      async lowerHand(userId?: string) {
        setHands((h) => h.filter((x) => x.userId !== (userId ?? me.userId)));
        return ok(null);
      },
      async react() {
        return ok(null);
      },
      async removeAttendee() {
        return ok(null);
      },
      async setAnswered(id: string, answered: boolean) {
        setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, answeredAt: answered ? new Date().toISOString() : null } : q)));
        return ok(null);
      },
      async updateSettings(patch: Partial<Settings>) {
        setSettings((s) => ({ ...s, ...patch }));
        return ok(null);
      },
      async announce() {
        return ok(null);
      },
      burstDone() {},
    };
    return a as unknown as RoomActions;
  }, [me]);

  const status = state === "waiting" ? "scheduled" : state === "live" ? "live" : "ended";
  const broadcast: Broadcast = {
    state: status === "live" ? "connected" : "idle",
    error: null,
    hostVideo: null,
    screenVideo: null,
    hostAudio: status === "live",
    audioBlocked: false,
    unblockAudio: () => {},
    network: status === "live" ? 2 : 0,
    volume: 80,
    setVolume: () => {},
  };
  const members = [HOST, ...ATTENDEES];
  const spotlight = questions.find((q) => q.id === settings.spotlightQuestionId) ?? null;
  const togglePanel = (p: Panel) => setPanel((cur) => (cur === p ? null : p));
  const badges = {
    chat: panel === "chat" ? undefined : messages.length || undefined,
    qna: panel === "qna" ? undefined : questions.filter((q) => !q.answeredAt).length || undefined,
    polls: !isHost && polls.some((p) => !p.closed && p.myVote === null) ? ("dot" as const) : undefined,
    people: isHost ? hands.length || undefined : undefined,
  };

  return (
    <div className="dark flex h-dvh overflow-hidden bg-stage text-foreground">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1">
          <Stage
            isHost={isHost}
            status={status}
            hostName={HOST.name}
            startsAt={new Date(now + 12 * 60_000).toISOString()}
            camera={media.camera}
            screen={media.screen}
            micOn={media.micOn}
            micLevel={0}
            broadcast={broadcast}
            bursts={[]}
            onBurstDone={() => {}}
            spotlight={spotlight}
          >
            {status === "live" && <PollOverlay polls={polls} isHost={isHost} actions={actions} />}
          </Stage>
          <RoomTopBar
            title="Growth Masterclass for Coaches"
            backHref="/dev/ui"
            status={status}
            startedAt={status === "live" ? iso(14) : null}
            isHost={isHost}
            recording={settings.recording}
            reconnecting={false}
            network={broadcast.network}
            liveCount={state === "waiting" ? 23 : 147}
          />
          <Badge variant="sample" className="absolute top-16 left-4 z-10 sm:top-18">
            Sample data
          </Badge>
          <div className="absolute inset-x-0 bottom-0 flex justify-center p-3 sm:p-4">
            <Dock
              isHost={isHost}
              status={status}
              media={media}
              micLevel={0}
              handRaised={hands.some((h) => h.userId === me.userId)}
              handRaiseEnabled={settings.handRaiseEnabled}
              reactionsEnabled={settings.reactionsEnabled}
              panel={panel}
              badges={badges}
              recorder={{ state: settings.recording ? "recording" : "idle", supported: true }}
              volume={broadcast.volume}
              onVolume={() => {}}
              onPanel={togglePanel}
              onReact={() => {}}
              onToggleHand={() => void (hands.some((h) => h.userId === me.userId) ? actions.lowerHand() : actions.raiseHand())}
              onToggleRecord={() => setSettings((s) => ({ ...s, recording: !s.recording }))}
              onSettings={() => {}}
              onShortcuts={() => {}}
              onGoLive={() => {}}
              onEnd={() => {}}
              onLeave={() => {}}
              goingLive={false}
            />
          </div>
        </div>
        <MobilePanelNav panel={panel} badges={badges} onPanel={togglePanel} />
      </div>

      <RoomDrawer
        panel={panel}
        count={panel === "people" ? members.length : panel === "qna" ? questions.filter((q) => !q.answeredAt).length : undefined}
        onClose={() => setPanel(null)}
      >
        {panel === "chat" && <ChatPanel messages={messages} me={me} settings={settings} actions={actions} />}
        {panel === "qna" && <QnaPanel questions={questions} me={me} settings={settings} actions={actions} />}
        {panel === "polls" && <PollsPanel polls={polls} me={me} actions={actions} />}
        {panel === "people" && <PeoplePanel members={members} handRaises={hands} me={me} actions={actions} />}
      </RoomDrawer>

      <RoomOverlay
        kind={state === "ended" ? "ended" : state === "removed" ? "removed" : null}
        isHost={isHost}
        webinarId={WEBINAR_ID}
        error={state === "removed" ? "The host removed you from this webinar." : null}
      />
    </div>
  );
}
