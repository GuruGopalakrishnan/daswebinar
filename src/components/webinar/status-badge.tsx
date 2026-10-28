import { Badge, PingDot } from "@/components/ui/badge";
import type { WebinarStatus } from "@/lib/webinars/types";

const STYLES: Record<WebinarStatus, { label: string; variant: "live" | "teal" | "default" | "danger" }> = {
  live: { label: "Live", variant: "live" },
  scheduled: { label: "Scheduled", variant: "teal" },
  draft: { label: "Draft", variant: "default" },
  ended: { label: "Ended", variant: "default" },
  cancelled: { label: "Cancelled", variant: "danger" },
};

export function StatusBadge({ status, className }: { status: WebinarStatus; className?: string }) {
  const style = STYLES[status];
  return (
    <Badge variant={style.variant} className={className}>
      {status === "live" && <PingDot />}
      {style.label}
    </Badge>
  );
}
