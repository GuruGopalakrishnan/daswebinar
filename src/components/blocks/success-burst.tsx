import { PublishArt } from "@/components/motion-graphics/small";
import { cn } from "@/lib/utils";

/**
 * Success moment for big actions (publish, upgrade): green-tinted panel, a check that pops and draws in,
 * or the publish burst illustration. Plays once on mount; still under reduced motion.
 */
export function SuccessBurst({
  title,
  description,
  action,
  art = "check",
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  art?: "check" | "publish";
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-xl border border-[color-mix(in_oklch,var(--success)_25%,transparent)] bg-[linear-gradient(120deg,var(--success-subtle),var(--card))] px-5 py-4 shadow-card motion-safe:animate-[route-in_320ms_var(--ease-out)_both]",
        className,
      )}
    >
      {art === "publish" ? (
        <PublishArt />
      ) : (
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-success text-white motion-safe:animate-[check-pop_520ms_var(--ease-out)_120ms_both]">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6 9 17l-5-5" strokeDasharray="30" className="motion-safe:[stroke-dashoffset:30] motion-safe:animate-[check-draw_420ms_var(--ease-out)_320ms_forwards]" />
          </svg>
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
