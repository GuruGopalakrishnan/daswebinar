"use client";

import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Selectable card around a native radio or checkbox (keyboard and screen-reader behaviour come from the
 * input). Selected cards get the teal ring.
 */
export function ChoiceCard({
  type = "radio",
  name,
  value,
  checked,
  onChange,
  icon: Icon,
  title,
  description,
  disabled,
  className,
}: {
  type?: "radio" | "checkbox";
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string, checked: boolean) => void;
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 rounded-xl border bg-card px-4 py-3.5 text-left transition-[border-color,background-color,box-shadow,transform] duration-[220ms] ease-out hover:border-input active:scale-[0.995] has-[:checked]:border-teal has-[:checked]:bg-teal-subtle has-[:checked]:shadow-[inset_0_0_0_1px_var(--teal)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
        className,
      )}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(value, e.target.checked)}
        className="mt-[3px] size-4 shrink-0 accent-[var(--teal)]"
      />
      {Icon && (
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted">
          <Icon aria-hidden className="size-4" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        {description && <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{description}</span>}
      </span>
    </label>
  );
}

/** Small toggle group (the prototype's segmented buttons). */
export function Segmented<T extends string>({
  options,
  value,
  onValueChange,
  label,
  className,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onValueChange: (value: T) => void;
  /** Accessible name for the group. */
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("inline-flex max-w-full gap-0.5 overflow-x-auto rounded-md bg-muted p-[3px]", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onValueChange(o.value)}
          className="h-[30px] cursor-pointer rounded-[6px] px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-[background-color,color,box-shadow] duration-[180ms] ease-out hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-card"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Vertical wizard step list: number circles, navy for the current step, teal check for done steps. */
export function WizardSteps({
  steps,
  current,
  onSelect,
  className,
}: {
  steps: { label: string; icon?: LucideIcon }[];
  /** Zero-based. */
  current: number;
  /** Omit to make the list display-only. */
  onSelect?: (index: number) => void;
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-col gap-1", className)}>
      {steps.map((s, i) => {
        const done = i < current;
        const isCurrent = i === current;
        const content = (
          <>
            <span
              className={cn(
                "grid size-[26px] shrink-0 place-items-center rounded-full border border-input bg-card text-xs transition-[background-color,border-color,color] duration-[220ms] ease-out",
                isCurrent && "border-primary bg-primary text-primary-foreground",
                done && "border-teal bg-teal text-teal-foreground motion-safe:animate-[pop-in_240ms_var(--ease-out)]",
              )}
            >
              {done ? <Check aria-hidden className="size-3.5" /> : i + 1}
            </span>
            <span className="truncate">{s.label}</span>
            {done && <span className="sr-only">(done)</span>}
          </>
        );
        const cls = cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-[background-color,color,box-shadow] duration-[220ms] ease-out",
          isCurrent && "bg-card text-foreground shadow-card",
          onSelect && !isCurrent && "cursor-pointer hover:bg-accent hover:text-foreground",
        );
        return (
          <li key={s.label}>
            {onSelect ? (
              <button type="button" className={cls} aria-current={isCurrent ? "step" : undefined} onClick={() => onSelect(i)}>
                {content}
              </button>
            ) : (
              <div className={cls} aria-current={isCurrent ? "step" : undefined}>
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Thin progress bar above wizard content. */
export function WizardProgress({ current, total, className }: { current: number; total: number; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-label="Progress"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current + 1}
      className={cn("h-1 overflow-hidden rounded-full bg-muted", className)}
    >
      <span className="block h-full rounded-full bg-teal transition-[width] duration-[360ms] ease-out" style={{ width: `${((current + 1) / total) * 100}%` }} />
    </div>
  );
}
