import { Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
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
 * First-run guide on the dashboard. Every step's "done" comes from real data
 * (webinars, registrations, live sessions), so it can't drift from reality.
 */
export function OnboardingChecklist({ steps, className }: { steps: OnboardingStep[]; className?: string }) {
  const done = steps.filter((s) => s.done).length;
  const current = steps.find((s) => !s.done)?.id;

  return (
    <section aria-labelledby="onboarding-heading" className={cn("rounded-2xl border bg-card shadow-card", className)}>
      <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 id="onboarding-heading" className="font-display text-2xl leading-tight">
            Get your first webinar live
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Four steps. Most hosts finish in under ten minutes.</p>
        </div>
        <div className="flex items-center gap-3 sm:w-48">
          <Progress value={(done / steps.length) * 100} className="h-1.5" aria-label={`${done} of ${steps.length} steps done`} />
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {done}/{steps.length}
          </span>
        </div>
      </div>

      <ol className="divide-y">
        {steps.map((step, i) => {
          const isCurrent = step.id === current;
          return (
            <li
              key={step.id}
              className={cn("flex gap-4 p-5 sm:items-center sm:px-6", isCurrent && "bg-primary/[0.035]")}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium tabular-nums transition-colors",
                  step.done && "border-success/30 bg-success/15 text-success",
                  isCurrent && "border-primary bg-primary text-primary-foreground",
                  !step.done && !isCurrent && "text-muted-foreground",
                )}
              >
                {step.done ? <Check className="size-4" aria-label="Done" /> : i + 1}
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
