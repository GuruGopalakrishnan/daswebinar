"use client";

import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type ShortcutHandlers = Partial<Record<"mic" | "camera" | "screen" | "hand" | "chat" | "qna" | "polls" | "people" | "record" | "fullscreen" | "help" | "escape", () => void>> & {
  react?: (index: number) => void;
  /** Push to talk: called with true while Space is held (host, muted), false on release. */
  pushToTalk?: (down: boolean) => void;
};

const KEYS: Record<string, keyof ShortcutHandlers> = {
  m: "mic",
  v: "camera",
  s: "screen",
  h: "hand",
  c: "chat",
  q: "qna",
  p: "polls",
  u: "people",
  r: "record",
  f: "fullscreen",
  "?": "help",
  Escape: "escape",
};

function typing(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)));
}

/** Single-key shortcuts, ignored while typing in chat or a form field. */
export function useShortcuts(handlers: ShortcutHandlers) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      const h = ref.current;
      if (e.code === "Space" && h.pushToTalk) {
        e.preventDefault();
        if (!e.repeat) h.pushToTalk(true);
        return;
      }
      if (/^[1-8]$/.test(e.key) && h.react) {
        h.react(Number(e.key) - 1);
        return;
      }
      const name = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
      const fn = name && name !== "react" && name !== "pushToTalk" ? h[name] : undefined;
      if (fn) {
        e.preventDefault();
        (fn as () => void)();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" && ref.current.pushToTalk && !typing(e.target)) ref.current.pushToTalk(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);
}

// host: host only. stage: host and panelists. attendee: everyone but the host.
const LIST: { keys: string; label: string; host?: boolean; stage?: boolean; attendee?: boolean }[] = [
  { keys: "M", label: "Mute / unmute", stage: true },
  { keys: "Space", label: "Hold to talk while muted", stage: true },
  { keys: "V", label: "Start / stop video", stage: true },
  { keys: "S", label: "Present screen", host: true },
  { keys: "R", label: "Start / stop recording", host: true },
  { keys: "H", label: "Raise / lower hand", attendee: true },
  { keys: "1 – 8", label: "Send a reaction" },
  { keys: "C", label: "Chat" },
  { keys: "Q", label: "Q&A" },
  { keys: "P", label: "Polls" },
  { keys: "U", label: "People" },
  { keys: "F", label: "Fullscreen" },
  { keys: "Esc", label: "Close panel" },
  { keys: "?", label: "Show shortcuts" },
];

export function ShortcutsDialog({
  open,
  onOpenChange,
  isHost,
  canPublish,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isHost: boolean;
  canPublish: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>They work anywhere in the room except while typing.</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-1 text-sm">
          {LIST.filter((s) => (isHost ? !s.attendee : !s.host && (!s.stage || canPublish))).map((s) => (
            <li key={s.label} className="flex items-center justify-between rounded-md px-1 py-1.5">
              {s.label}
              <kbd className="rounded-md border bg-muted px-2 py-0.5 font-mono text-xs">{s.keys}</kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
