"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useNow } from "@/hooks/use-client-values";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, ArrowDown, Lock, MessageSquare, RotateCw, SendHorizontal, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import type { Author, Settings } from "@/lib/realtime/protocol";
import { HostTag, PanelEmpty } from "./room-chrome";
import type { LocalMessage, RoomActions } from "./use-room";

const MAX = 500;
const GROUP_MS = 2 * 60_000;

function timeLabel(iso: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function ChatPanel({
  messages,
  me,
  settings,
  actions,
}: {
  messages: LocalMessage[];
  me: Author | null;
  settings: Settings | null;
  actions: RoomActions;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const lastCount = useRef(messages.length);

  const isHost = me?.role === "host";
  const disabled = settings !== null && !settings.chatEnabled && !isHost;

  // Stick to the bottom unless the user scrolled up to read history.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const added = messages.length - lastCount.current;
    lastCount.current = messages.length;
    const mineAtEnd = messages.at(-1)?.author.userId === me?.userId;
    if (atBottom || mineAtEnd) el.scrollTop = el.scrollHeight;
    else if (added > 0) setUnseen((n) => n + added);
  }, [messages, atBottom, me?.userId]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    setAtBottom(bottom);
    if (bottom) setUnseen(0);
  }

  function jumpToBottom() {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
    setUnseen(0);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          onScroll={onScroll}
          className="h-full overflow-y-auto px-3 py-3 scrollbar-thin"
          role="log"
          aria-live="polite"
          aria-label="Chat messages"
        >
          {messages.length === 0 ? (
            <PanelEmpty icon={MessageSquare} title="Say hello">
              Messages from everyone in the room appear here.
            </PanelEmpty>
          ) : (
            <ol className="grid gap-0.5">
              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const grouped =
                  prev !== undefined &&
                  prev.author.userId === m.author.userId &&
                  new Date(m.sentAt).getTime() - new Date(prev.sentAt).getTime() < GROUP_MS;
                const mine = m.author.userId === me?.userId;
                return (
                  <motion.li
                    key={m.clientMessageId + m.author.userId}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: m.pending ? 0.6 : 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className={cn("group flex gap-2.5 rounded-md px-1.5 py-0.5 transition-colors duration-[120ms] hover:bg-accent/50", !grouped && "mt-3 first:mt-0")}
                  >
                    <div className="w-7 shrink-0">
                      {!grouped && <UserAvatar name={m.author.name} id={m.author.userId} className="size-7 text-[10px]" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      {!grouped && (
                        <div className="flex items-baseline gap-1.5">
                          <span className={cn("truncate text-[13px] font-semibold", mine && "text-teal")}>
                            {mine ? "You" : m.author.name}
                          </span>
                          {m.author.role === "host" && <HostTag />}
                          <time dateTime={m.sentAt} className="text-[11px] text-muted-foreground">
                            {timeLabel(m.sentAt)}
                          </time>
                        </div>
                      )}
                      <p className="text-sm leading-5 break-words whitespace-pre-wrap">{m.text}</p>
                      {m.failed && (
                        <button
                          onClick={() => actions.sendMessage(m.text, m.clientMessageId)}
                          className="mt-0.5 inline-flex cursor-pointer items-center gap-1 text-xs text-destructive hover:underline"
                        >
                          <AlertCircle className="size-3" /> Not sent · <RotateCw className="size-3" /> Retry
                        </button>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          )}
        </div>
        <AnimatePresence>
          {unseen > 0 && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              onClick={jumpToBottom}
              className="absolute bottom-3 left-1/2 inline-flex h-7 -translate-x-1/2 cursor-pointer items-center gap-1 rounded-full bg-teal px-3 text-xs font-semibold text-teal-foreground shadow-elevated"
            >
              <ArrowDown className="size-3" /> {unseen} new
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <Composer disabled={disabled} settings={settings} isHost={isHost} onSend={actions.sendMessage} />
    </div>
  );
}

function Composer({
  disabled,
  settings,
  isHost,
  onSend,
}: {
  disabled: boolean;
  settings: Settings | null;
  isHost: boolean;
  onSend: RoomActions["sendMessage"];
}) {
  const [text, setText] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const now = useNow() ?? 0;

  const slowMode = !isHost && settings ? settings.slowModeSeconds : 0;
  const remaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  // Auto-grow up to ~5 lines.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  async function send() {
    const value = text.trim();
    if (!value || disabled || remaining) return;
    setText("");
    const res = await onSend(value);
    if (!res.ok) {
      if (res.error.code === "slow_mode" || res.error.code === "rate_limited") setText(value);
      toast.error(res.error.message);
    } else if (slowMode) {
      setCooldownUntil(Date.now() + slowMode * 1000);
    }
  }

  if (disabled) {
    return (
      <div className="flex items-center gap-2 border-t bg-surface-2 px-4 py-3.5 text-sm text-muted-foreground">
        <Lock className="size-4" /> The host has turned off chat.
      </div>
    );
  }

  return (
    <div className="border-t p-3">
      <div className="flex items-end gap-2 rounded-md border border-input bg-surface-2 py-1.5 pr-1.5 pl-3 transition-[border-color,box-shadow] duration-[220ms] ease-out focus-within:border-ring focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--ring)_22%,transparent)]">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-input"
          ref={ref}
          rows={1}
          value={text}
          maxLength={MAX}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={remaining ? `Slow mode — wait ${remaining}s` : "Send a message…"}
          className="max-h-[120px] min-h-6 flex-1 resize-none self-center bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button
          size="icon-sm"
          variant="teal"
          onClick={() => void send()}
          disabled={!text.trim() || remaining > 0}
          aria-label="Send message"
          className="shrink-0"
        >
          <SendHorizontal />
        </Button>
      </div>
      <div className="mt-1.5 flex h-4 items-center justify-between px-1 text-[11px] text-muted-foreground">
        <span>{slowMode > 0 && <span className="inline-flex items-center gap-1"><Timer className="size-3" /> Slow mode: {slowMode}s</span>}</span>
        {text.length > MAX - 80 && <span className="tabular-nums">{MAX - text.length}</span>}
      </div>
    </div>
  );
}
