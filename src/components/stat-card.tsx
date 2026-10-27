import { cn } from "@/lib/utils";

/** A single metric: label + icon on top, the number below, optional hint. */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone,
  className,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  tone?: "live";
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-card", tone === "live" && value > 0 && "border-live/30", className)}>
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="truncate">{label}</span>
        <Icon className={cn("size-4 shrink-0", tone === "live" && value > 0 && "text-live")} />
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value.toLocaleString()}</p>
      {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
