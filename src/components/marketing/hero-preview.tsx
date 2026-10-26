"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BarChart3, Hand, MessageSquare, Mic, Radio, Users, Video } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";

// Illustrative product preview for the landing page (not live data).
const SCRIPT = [
  { name: "Priya", text: "This is exactly what I needed 🙌" },
  { name: "Marcus", text: "Will the slides be shared after?" },
  { name: "Lena", text: "Great demo — love the polls" },
  { name: "Tomás", text: "Joining from Lisbon 👋" },
  { name: "Aiko", text: "Can we use custom fields on signup?" },
];
const EMOJI = ["🎉", "❤️", "👏", "🔥", "👍"];

export function HeroPreview() {
  const reduce = useReducedMotion();
  const [count, setCount] = useState(3);
  const [bursts, setBursts] = useState<{ id: number; emoji: string; x: number }[]>([]);

  useEffect(() => {
    if (reduce) return;
    const chat = setInterval(() => setCount((c) => (c >= SCRIPT.length ? 3 : c + 1)), 2600);
    let n = 0;
    const react = setInterval(() => {
      const id = n++;
      setBursts((b) => [...b.slice(-6), { id, emoji: EMOJI[id % EMOJI.length]!, x: 10 + ((id * 37) % 70) }]);
    }, 900);
    return () => {
      clearInterval(chat);
      clearInterval(react);
    };
  }, [reduce]);

  const messages = SCRIPT.slice(Math.max(0, count - 3), count);

  return (
    <div className="relative rounded-2xl border bg-card/70 p-2 shadow-2xl shadow-primary/10 backdrop-blur ring-1 ring-white/5">
      {/* window chrome */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
          <span className="size-2.5 rounded-full bg-foreground/15" />
        </div>
        <div className="mx-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-live/15 px-2 py-0.5 font-medium text-live">
            <Radio className="size-3" /> LIVE
          </span>
          Product Launch Q&amp;A
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="size-3.5" /> 1,284
        </span>
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_260px]">
        {/* stage */}
        <div className="relative aspect-video overflow-hidden rounded-xl bg-stage">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,oklch(0.66_0.19_280/0.35),transparent_60%),radial-gradient(ellipse_at_80%_90%,oklch(0.7_0.16_320/0.25),transparent_55%)]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <span className="absolute -inset-2 animate-pulse rounded-full bg-primary/25 blur-md" />
                <UserAvatar name="Sam Rivera" className="relative size-20 text-xl" />
              </div>
              <span className="rounded-full bg-black/40 px-3 py-1 text-xs text-white/90 backdrop-blur">
                Sam Rivera · Host
              </span>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 overflow-hidden">
            <AnimatePresence>
              {bursts.map((b) => (
                <motion.span
                  key={b.id}
                  initial={{ y: 40, opacity: 0, scale: 0.6 }}
                  animate={{ y: -160, opacity: [0, 1, 1, 0], scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 2.6, ease: "easeOut" }}
                  className="absolute bottom-0 text-2xl"
                  style={{ left: `${b.x}%` }}
                >
                  {b.emoji}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/40 p-1.5 backdrop-blur">
            {[Mic, Video, Hand].map((Icon, i) => (
              <span key={i} className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white">
                <Icon className="size-4" />
              </span>
            ))}
          </div>
        </div>

        {/* sidebar */}
        <div className="hidden flex-col gap-2 md:flex">
          <div className="flex-1 rounded-xl border bg-background/60 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <MessageSquare className="size-3.5" /> Chat
            </div>
            <div className="flex flex-col gap-2.5">
              <AnimatePresence initial={false} mode="popLayout">
                {messages.map((m) => (
                  <motion.div
                    layout
                    key={m.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-2"
                  >
                    <UserAvatar name={m.name} className="size-6 text-[9px]" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.text}</div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
          <div className="rounded-xl border bg-background/60 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <BarChart3 className="size-3.5" /> Poll · Which feature next?
            </div>
            {[
              ["Breakout rooms", 62],
              ["Live captions", 28],
              ["Whiteboard", 10],
            ].map(([label, pct]) => (
              <div key={label} className="mb-1.5">
                <div className="mb-0.5 flex justify-between text-[11px]">
                  <span>{label}</span>
                  <span className="text-muted-foreground">{pct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${pct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
