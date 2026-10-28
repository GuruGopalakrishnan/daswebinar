import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  done: boolean;
  /** The control that completes the step. Shown only while the step is open. */
  action?: React.ReactNode;
};

/**
 * First-run guide ("Get set up"). Every step's "done" comes from real data (webinars, registrations, live
 * sessions), so it can't drift from reality. The current step is highlighted and carries its own button.
 */
export function OnboardingChecklist({ steps, className }: { steps: OnboardingStep[]; className?: string }) {
  const done = steps.filter((s) => s.done).length;
  const current = steps.find((s) => !s.done)?.id;

  return (
    <section aria-labelledby="onboarding-heading" className={cn("min-w-0 rounded-xl border border-border/85 bg-card shadow-card", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-6 md:py-4">
        <div>
          <h2 id="onboarding-heading" className="text-base leading-6 font-semibold">
            Get your first webinar live
          </h2>
          <p className="text-sm text-muted-foreground">Four steps. Most hosts finish in under ten minutes.</p>
        </div>
        <div className="flex items-center gap-3 sm:w-48">
          <div
            role="progressbar"
            aria-label={`${done} of ${steps.length} steps done`}
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-valuenow={done}
            className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <span className="block h-full rounded-full bg-teal transition-[width] duration-300 ease-out" style={{ width: `${(done / steps.length) * 100}%` }} />
          </div>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {done} of {steps.length} done
          </span>
        </div>
      </div>

      <ol>
        {steps.map((step, i) => {
          const isCurrent = step.id === current;
          return (
            <li
              key={step.id}
              className={cn(
                "flex gap-4 border-b px-4 py-3.5 last:border-b-0 sm:items-center md:px-6",
                isCurrent && "bg-[color-mix(in_oklch,var(--teal-subtle)_55%,transparent)]",
              )}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular-nums transition-colors duration-[220ms]",
                  step.done && "bg-teal text-teal-foreground",
                  isCurrent && "bg-primary text-primary-foreground",
                  !step.done && !isCurrent && "bg-muted text-muted-foreground",
                )}
              >
                {step.done ? <Check className="size-3.5" aria-label="Done" /> : i + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className={cn("text-sm font-medium", step.done && "text-muted-foreground line-through decoration-muted-foreground/40")}>
                    {step.title}
                  </p>
                  {!step.done && <p className="mt-0.5 text-sm text-pretty text-muted-foreground">{step.description}</p>}
                </div>
                {!step.done && isCurrent && step.action && <div className="shrink-0">{step.action}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
