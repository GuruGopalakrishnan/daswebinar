"use client";

import { useEffect } from "react";
import { useNow } from "@/hooks/use-client-values";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(s / 86_400),
    hours: Math.floor((s % 86_400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

/** Ticking countdown. Renders a placeholder until mounted to avoid hydration drift. */
export function Countdown({ to, onDone }: { to: string; onDone?: () => void }) {
  const now = useNow();
  const remaining = now === null ? null : new Date(to).getTime() - now;
  const done = remaining !== null && remaining <= 0;

  useEffect(() => {
    if (done) onDone?.();
  }, [done, onDone]);

  if (remaining === null) return <div className="h-[68px]" aria-hidden />;
  if (done) return null;

  const p = parts(remaining);
  const units = [
    ["days", p.days],
    ["hours", p.hours],
    ["min", p.minutes],
    ["sec", p.seconds],
  ] as const;

  return (
    <div className="flex gap-2" role="timer" aria-label="Time until start">
      {units.map(([label, value]) => (
        <div key={label} className="min-w-16 rounded-xl border bg-card px-3 py-2 text-center shadow-xs">
          <div className="font-mono text-2xl font-semibold tabular-nums">{String(value).padStart(2, "0")}</div>
          <div className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</div>
        </div>
      ))}
    </div>
  );
}
