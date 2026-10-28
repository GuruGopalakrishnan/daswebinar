import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  info: { box: "border-[color-mix(in_oklch,var(--teal)_25%,transparent)] bg-teal-subtle", icon: "text-teal", Icon: Info },
  warn: { box: "border-[color-mix(in_oklch,var(--warning)_50%,transparent)] bg-warning-subtle", icon: "text-warning-text", Icon: AlertTriangle },
  danger: { box: "border-[color-mix(in_oklch,var(--destructive)_30%,transparent)] bg-destructive-subtle", icon: "text-destructive", Icon: XCircle },
  success: { box: "border-[color-mix(in_oklch,var(--success)_30%,transparent)] bg-success-subtle", icon: "text-success", Icon: CheckCircle2 },
} satisfies Record<string, { box: string; icon: string; Icon: LucideIcon }>;

/** Inline message box: icon, optional bold title, text, optional action on the right. */
export function Callout({
  tone = "info",
  title,
  icon,
  action,
  className,
  children,
}: {
  tone?: keyof typeof TONES;
  title?: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  const t = TONES[tone];
  const Icon = icon ?? t.Icon;
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn("flex gap-3 rounded-md border px-4 py-3 text-sm text-foreground", t.box, className)}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", t.icon)} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "text-pretty")}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
