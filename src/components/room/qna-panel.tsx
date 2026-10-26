"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronUp, Lock, MessageCircleQuestion } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import type { Author, Question, Settings } from "@/lib/realtime/protocol";
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
  const [sort, setSort] = useState<"top" | "new">("top");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const isHost = me?.role === "host";
  const disabled = settings !== null && !settings.qnaEnabled && !isHost;

  const sorted = [...questions].sort((a, b) =>
    sort === "top" ? b.upvotes - a.upvotes || b.askedAt.localeCompare(a.askedAt) : b.askedAt.localeCompare(a.askedAt),
  );

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
      <div className="flex items-center gap-1 border-b px-3 py-2">
        {(["top", "new"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            aria-pressed={sort === s}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs transition-colors",
              sort === s ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s === "top" ? "Top" : "Newest"}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{questions.length} questions</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 scrollbar-thin">
        {sorted.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <MessageCircleQuestion className="size-6" />
            <p>No questions yet. Ask the first one!</p>
          </div>
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
                    className="flex gap-3 rounded-xl border bg-background p-3"
                  >
                    <button
                      onClick={() => upvote(q.id)}
                      disabled={mine}
                      aria-pressed={q.upvotedByMe}
                      aria-label={`Upvote (${q.upvotes})`}
                      title={mine ? "You can't upvote your own question" : undefined}
                      className={cn(
                        "flex h-12 w-10 shrink-0 flex-col items-center justify-center rounded-lg border text-xs font-medium tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                        q.upvotedByMe ? "border-primary/50 bg-primary/10 text-primary" : "hover:border-foreground/20",
                      )}
                    >
                      <ChevronUp className="size-4" />
                      {q.upvotes}
                    </button>
                    <div className="min-w-0">
                      <p className="text-sm break-words">{q.text}</p>
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <UserAvatar name={q.author.name} id={q.author.userId} className="size-4 text-[7px]" />
                        {mine ? "You" : q.author.name}
                      </p>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>

      <div className="border-t p-3">
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
              <Button size="sm" onClick={() => void ask()} disabled={!text.trim() || sending}>
                Ask question
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
