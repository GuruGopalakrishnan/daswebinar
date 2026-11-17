"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, ChevronUp, Lock, MessageCircleQuestion, Presentation } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Segmented } from "@/components/blocks/choices";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import type { Author, Question, Settings } from "@/lib/realtime/protocol";
import { HostTag, PanelEmpty } from "./room-chrome";
import type { RoomActions } from "./use-room";

export function QnaPanel({
  questions,
  me,
  settings,
  actions,
}: {
  questions: Question[];
  me: Author | null;
  settings: Settings | null;
  actions: RoomActions;
}) {
  const [sort, setSort] = useState<"top" | "new" | "answered">("top");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const isHost = me?.role === "host";
  const disabled = settings !== null && !settings.qnaEnabled && !isHost;

  const spotlightId = settings?.spotlightQuestionId ?? null;
  const sorted = questions
    .filter((q) => (sort === "answered" ? q.answeredAt : !q.answeredAt))
    .sort((a, b) =>
      sort === "top" ? b.upvotes - a.upvotes || b.askedAt.localeCompare(a.askedAt) : b.askedAt.localeCompare(a.askedAt),
    );

  async function spotlight(id: string | null) {
    const res = await actions.updateSettings({ spotlightQuestionId: id });
    if (!res.ok) toast.error(res.error.message);
  }

  async function answer(id: string, answered: boolean) {
    const res = await actions.setAnswered(id, answered);
    if (!res.ok) toast.error(res.error.message);
  }

  async function ask() {
    const value = text.trim();
    if (!value) return;
    setSending(true);
    const res = await actions.ask(value);
    setSending(false);
    if (res.ok) {
      setText("");
      toast.success("Question submitted");
    } else toast.error(res.error.message);
  }

  async function upvote(id: string) {
    const res = await actions.upvote(id);
    if (!res.ok) toast.error(res.error.message);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <Segmented
          label="Sort questions"
          value={sort}
          onValueChange={setSort}
          options={[
            { value: "top", label: "Top" },
            { value: "new", label: "Newest" },
            { value: "answered", label: "Answered" },
          ]}
        />
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{questions.filter((q) => !q.answeredAt).length} open</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 scrollbar-thin">
        {sorted.length === 0 ? (
          <PanelEmpty icon={MessageCircleQuestion} title={sort === "answered" ? "Nothing answered yet" : "No questions yet"}>
            {sort === "answered"
              ? "Questions you mark answered move here."
              : isHost
                ? "Questions from your audience appear here, most upvoted first."
                : "Ask the first one. Others can upvote it."}
          </PanelEmpty>
        ) : (
          <motion.ul layout className="grid gap-2">
            <AnimatePresence initial={false}>
              {sorted.map((q) => {
                const mine = q.author.userId === me?.userId;
                return (
                  <motion.li
                    layout
                    key={q.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      "flex gap-3 rounded-xl border bg-surface-2 p-3",
                      spotlightId === q.id && "border-teal/60 ring-1 ring-teal/30",
                      q.answeredAt && "opacity-70",
                    )}
                  >
                    <button
                      onClick={() => upvote(q.id)}
                      disabled={mine}
                      aria-pressed={q.upvotedByMe}
                      aria-label={`Upvote (${q.upvotes})`}
                      title={mine ? "You can't upvote your own question" : undefined}
                      className={cn(
                        "flex h-12 w-11 shrink-0 cursor-pointer flex-col items-center justify-center rounded-md border text-xs font-semibold tabular-nums transition-colors duration-[180ms] focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60",
                        q.upvotedByMe ? "border-teal/50 bg-teal-subtle text-teal" : "bg-card hover:border-foreground/25",
                      )}
                    >
                      <ChevronUp className="size-4" />
                      {q.upvotes}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-5 break-words">{q.text}</p>
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <UserAvatar name={q.author.name} id={q.author.userId} className="size-4 text-[7px]" />
                        {mine ? "You" : q.author.name}
                        {q.author.role === "host" && <HostTag />}
                        {q.answeredAt && (
                          <span className="inline-flex items-center gap-0.5 text-success">
                            · <CheckCircle2 className="size-3" /> Answered
                          </span>
                        )}
                        {spotlightId === q.id && <span className="font-medium text-teal">· On stage</span>}
                      </p>
                      {isHost && (
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {!q.answeredAt && (
                            <Button variant="outline" size="xs" onClick={() => void spotlight(spotlightId === q.id ? null : q.id)}>
                              <Presentation /> {spotlightId === q.id ? "Hide from stage" : "Show on stage"}
                            </Button>
                          )}
                          <Button variant="ghost" size="xs" onClick={() => void answer(q.id, !q.answeredAt)}>
                            <CheckCircle2 /> {q.answeredAt ? "Reopen" : "Mark answered"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>

      <div className="border-t bg-card p-3">
        {disabled ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-4" /> Q&amp;A is closed.
          </p>
        ) : (
          <div className="grid gap-2">
            <label htmlFor="qna-input" className="sr-only">
              Your question
            </label>
            <Textarea
              id="qna-input"
              rows={2}
              maxLength={300}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void ask();
              }}
              placeholder="Ask the host a question…"
              className="resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground tabular-nums">{300 - text.length}</span>
              <Button size="sm" variant="teal" onClick={() => void ask()} disabled={!text.trim()} loading={sending}>
                Ask question
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
