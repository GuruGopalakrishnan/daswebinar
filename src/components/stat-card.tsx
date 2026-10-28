import { Sparkline } from "@/components/motion-graphics/small";
import { cn } from "@/lib/utils";

/** A single metric: label + icon on top, the number below, optional hint, trend line and change. */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone,
  spark,
  delta,
  className,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  tone?: "live";
  /** Recent values, oldest first. Only pass real data. */
  spark?: number[];
  /** Change vs the previous period, e.g. "+12%". Positive values show in green. */
  delta?: { label: string; positive: boolean };
  className?: string;
}) {
  const isLive = tone === "live" && typeof value === "number" && value > 0;
  return (
    <div className={cn("relative min-w-0 rounded-xl border border-border/85 bg-card p-4 shadow-card", isLive && "border-live/30", className)}>
      <div className="flex items-center justify-between gap-2 text-[13px] text-muted-foreground">
        <span className="truncate">{label}</span>
        <Icon className={cn("size-4 shrink-0", isLive && "text-live")} />
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-[28px] leading-9 font-semibold tracking-[-0.02em] tabular-nums">
          {typeof value === "number" ? value.toLocaleString("en-IN") : value}
        </p>
        {spark && <Sparkline data={spark} className="mb-1.5" />}
      </div>
      {(hint || delta) && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {delta && <span className={cn("mr-1 font-medium", delta.positive ? "text-success" : "text-destructive")}>{delta.label}</span>}
          {hint}
        </p>
      )}
    </div>
  );
}
