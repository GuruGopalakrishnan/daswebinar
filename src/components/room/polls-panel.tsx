"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BarChart3, Check, Lock, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Author, Poll } from "@/lib/realtime/protocol";
import type { RoomActions } from "./use-room";

export function PollsPanel({ polls, me, actions }: { polls: Poll[]; me: Author | null; actions: RoomActions }) {
  const isHost = me?.role === "host";
  const [creating, setCreating] = useState(false);
  const ordered = [...polls].sort((a, b) => Number(a.closed) - Number(b.closed) || b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-3 scrollbar-thin">
        {isHost && (
          <AnimatePresence initial={false} mode="wait">
            {creating ? (
              <motion.div key="form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <PollComposer onDone={() => setCreating(false)} actions={actions} />
              </motion.div>
            ) : (
              <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Button variant="outline" className="mb-3 w-full border-dashed" onClick={() => setCreating(true)}>
                  <Plus /> Create poll
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {ordered.length === 0 && !creating ? (
          <div className="flex h-[70%] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <BarChart3 className="size-6" />
            <p>{isHost ? "Launch a poll to hear from your audience." : "No polls yet. The host will launch them here."}</p>
          </div>
        ) : (
          <ul className="grid gap-3">
            {ordered.map((p) => (
              <PollCard key={p.id} poll={p} isHost={isHost} actions={actions} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PollComposer({ onDone, actions }: { onDone: () => void; actions: RoomActions }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [sending, setSending] = useState(false);

  const clean = options.map((o) => o.trim()).filter(Boolean);
  const valid = question.trim() && clean.length >= 2 && new Set(clean.map((o) => o.toLowerCase())).size === clean.length;

  async function launch() {
    setSending(true);
    const res = await actions.createPoll(question.trim(), clean);
    setSending(false);
    if (res.ok) {
      toast.success("Poll launched");
      onDone();
    } else toast.error(res.error.message);
  }

  return (
    <div className="mb-3 grid gap-2 rounded-xl border bg-background p-3">
      <Input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} placeholder="Ask a question…" aria-label="Poll question" autoFocus />
      {options.map((o, i) => (
        <div key={i} className="flex gap-1.5">
          <Input
            value={o}
            maxLength={100}
            onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder={`Option ${i + 1}`}
            aria-label={`Option ${i + 1}`}
            className="h-8"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={options.length <= 2}
            onClick={() => setOptions(options.filter((_, j) => j !== i))}
            aria-label={`Remove option ${i + 1}`}
          >
            <X />
          </Button>
        </div>
      ))}
      {options.length < 6 && (
        <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setOptions([...options, ""])}>
          <Plus /> Add option
        </Button>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" disabled={!valid || sending} onClick={() => void launch()}>
          Launch poll
        </Button>
      </div>
    </div>
  );
}

function PollCard({ poll, isHost, actions }: { poll: Poll; isHost: boolean; actions: RoomActions }) {
  const total = poll.options.reduce((s, o) => s + o.votes, 0);
  const showResults = isHost || poll.closed || poll.myVote !== null;
  const leader = Math.max(...poll.options.map((o) => o.votes));

  async function vote(optionId: string) {
    const res = await actions.vote(poll.id, optionId);
    if (!res.ok) toast.error(res.error.message);
  }
  async function close() {
    const res = await actions.closePoll(poll.id);
    if (!res.ok) toast.error(res.error.message);
  }

  return (
    <li className={cn("rounded-xl border bg-background p-3", !poll.closed && "border-primary/30")}>
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{poll.question}</p>
        {poll.closed ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
            <Lock className="size-3" /> Closed
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" /> Open
          </span>
        )}
      </div>
      <div className="grid gap-1.5">
        {poll.options.map((o) => {
          const pct = total ? Math.round((o.votes / total) * 100) : 0;
          const mine = poll.myVote === o.id;
          if (!showResults) {
            return (
              <button
                key={o.id}
                onClick={() => void vote(o.id)}
                className="rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                {o.text}
              </button>
            );
          }
          return (
            <button
              key={o.id}
              onClick={() => !poll.closed && !isHost && void vote(o.id)}
              disabled={poll.closed || isHost}
              aria-label={`${o.text}: ${pct}%`}
              className={cn(
                "relative overflow-hidden rounded-lg border px-3 py-2 text-left text-sm disabled:cursor-default",
                mine && "border-primary/50",
              )}
            >
              <motion.span
                aria-hidden
                className={cn("absolute inset-y-0 left-0", o.votes === leader && total > 0 ? "bg-primary/25" : "bg-muted")}
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ type: "spring", bounce: 0, duration: 0.6 }}
              />
              <span className="relative flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  {mine && <Check className="size-3.5 text-primary" />}
                  {o.text}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="tabular-nums">
          {total} {total === 1 ? "vote" : "votes"}
        </span>
        {isHost && !poll.closed && (
          <Button variant="ghost" size="xs" onClick={() => void close()}>
            End poll
          </Button>
        )}
      </div>
    </li>
  );
}
