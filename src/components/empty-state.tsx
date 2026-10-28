import { cn } from "@/lib/utils";

/** Centered "nothing here yet" block: soft teal icon tile, short message, one next step. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  art,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Optional illustration shown instead of the icon tile (e.g. <LifecycleScene />). */
  art?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      {art ?? (
        <div
          aria-hidden
          className="relative mb-2 grid size-16 place-items-center rounded-[20px] bg-[linear-gradient(160deg,var(--teal-subtle),var(--surface-2))] text-teal shadow-card before:absolute before:-top-1 before:-right-1.5 before:size-2.5 before:rounded-full before:bg-[color-mix(in_oklch,var(--teal)_18%,transparent)] after:absolute after:bottom-1.5 after:-left-2 after:size-1.5 after:rounded-full after:bg-[color-mix(in_oklch,var(--teal)_18%,transparent)]"
        >
          <Icon className="size-6" />
        </div>
      )}
      <p className="text-[17px] leading-6 font-semibold">{title}</p>
      {description && <p className="max-w-[360px] text-sm text-pretty text-muted-foreground">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
