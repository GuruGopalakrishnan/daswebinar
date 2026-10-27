"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BarChart3, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Poll } from "@/lib/realtime/protocol";
import type { RoomActions } from "./use-room";

/**
 * Zoom-style: a newly launched poll pops onto the stage for attendees, so
 * nobody has to find it in a side panel. After voting they see live results
 * for a few seconds; the host sees live results of the open poll.
 */
export function PollOverlay({ polls, isHost, actions }: { polls: Poll[]; isHost: boolean; actions: RoomActions }) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const open = [...polls].filter((p) => !p.closed && !dismissed.has(p.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  const dismiss = (id: string) => setDismissed((s) => new Set(s).add(id));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key={open.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
          className="absolute top-20 right-4 z-20 w-[min(88vw,320px)] rounded-2xl bg-card p-4 text-card-foreground shadow-2xl ring-1 ring-black/5"
          role="dialog"
          aria-label="Poll"
        >
          <PollBody poll={open} isHost={isHost} actions={actions} onDismiss={() => dismiss(open.id)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PollBody({ poll, isHost, actions, onDismiss }: { poll: Poll; isHost: boolean; actions: RoomActions; onDismiss: () => void }) {
  const total = poll.options.reduce((s, o) => s + o.votes, 0);
  const showResults = isHost || poll.myVote !== null;

  async function vote(optionId: string) {
    const res = await actions.vote(poll.id, optionId);
    if (!res.ok) toast.error(res.error.message);
  }

  return (
    <>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <BarChart3 className="size-3.5" />
        </span>
        <p className="flex-1 text-sm font-medium">{poll.question}</p>
        <button type="button" onClick={onDismiss} aria-label="Hide poll" className="-mt-1 -mr-1 rounded-full p-1 text-muted-foreground hover:bg-accent">
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-3 grid gap-1.5">
        {poll.options.map((o) => {
          const pct = total ? Math.round((o.votes / total) * 100) : 0;
          const mine = poll.myVote === o.id;
          return (
            <button
              key={o.id}
              type="button"
              disabled={isHost}
              onClick={() => void vote(o.id)}
              className={cn(
                "relative overflow-hidden rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default",
                !showResults && "hover:border-primary/60 hover:bg-primary/5",
                mine && "border-primary/60",
              )}
            >
              {showResults && (
                <motion.span
                  aria-hidden
                  className="absolute inset-y-0 left-0 bg-primary/15"
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", bounce: 0, duration: 0.6 }}
                />
              )}
              <span className="relative flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  {mine && <Check className="size-3.5 text-primary" />}
                  {o.text}
                </span>
                {showResults && <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground tabular-nums">
        {total} {total === 1 ? "vote" : "votes"}
        {!isHost && poll.myVote && " · tap another option to change your vote"}
      </p>
    </>
  );
}
