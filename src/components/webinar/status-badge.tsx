import { cn } from "@/lib/utils";
import type { WebinarStatus } from "@/lib/webinars/types";

const STYLES: Record<WebinarStatus, { label: string; className: string }> = {
  live: { label: "Live", className: "bg-live/15 text-live ring-live/30" },
  scheduled: { label: "Scheduled", className: "bg-primary/12 text-primary ring-primary/25" },
  draft: { label: "Draft", className: "bg-muted text-muted-foreground ring-border" },
  ended: { label: "Ended", className: "bg-muted text-muted-foreground ring-border" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive ring-destructive/25" },
};

export function StatusBadge({ status, className }: { status: WebinarStatus; className?: string }) {
  const style = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        style.className,
        className,
      )}
    >
      {status === "live" && (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-live" />
        </span>
      )}
      {style.label}
    </span>
  );
}
