import { ArrowRight, ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Card with a header row (title + actions) and a padded body, the prototype's card-head / card-body. */
export function SectionCard({
  title,
  actions,
  className,
  bodyClassName,
  children,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-border/85 bg-card text-card-foreground shadow-card", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-6 md:py-4">
          {title && <h2 className="text-base leading-6 font-semibold">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("p-4 md:p-6", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Interactive cards (links, buttons) lift slightly on hover. Add to a Card or SectionCard. */
export const cardInteractive =
  "hover:-translate-y-0.5 hover:shadow-raise motion-reduce:hover:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** A setting: title + help text on the left, its control on the right. Rows divide themselves. */
export function SettingRow({
  title,
  description,
  control,
  htmlFor,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  control: React.ReactNode;
  /** Id of the control, so the title acts as its label. */
  htmlFor?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-3.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-sm font-medium">
            {title}
          </label>
        ) : (
          <div className="text-sm font-medium">{title}</div>
        )}
        {description && <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

/** Collapsible group for advanced options (native <details>, works without JavaScript). */
export function Advanced({
  title,
  hint,
  defaultOpen,
  children,
  className,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details open={defaultOpen} className={cn("group rounded-md border bg-surface-2", className)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span>
          {title}
          {hint && <span className="ml-1.5 font-normal text-muted-foreground">{hint}</span>}
        </span>
        <ChevronDown aria-hidden className="size-4 transition-transform duration-[220ms] ease-out group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-2 motion-safe:animate-[fade-up_220ms_var(--ease-out)]">{children}</div>
    </details>
  );
}

/** One short sentence under the page's primary action saying what happens next. */
export function NextStep({ icon: Icon = ArrowRight, children, className }: { icon?: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-center gap-2 text-[13px] text-muted-foreground [&_b]:font-medium [&_b]:text-foreground", className)}>
      <Icon aria-hidden className="size-3.5 shrink-0 text-teal" />
      <span>{children}</span>
    </p>
  );
}

/** Usage against a plan limit ("Free webinar used: 1 of 1") with a progress bar. */
export function UsageMeter({
  label,
  used,
  limit,
  description,
  action,
  className,
}: {
  label: React.ReactNode;
  used: number;
  limit: number;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className={cn("flex flex-wrap items-center gap-4 rounded-xl border bg-card px-5 py-4", className)}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        className="h-2 w-40 overflow-hidden rounded-full bg-muted"
      >
        <span
          className="block h-full rounded-full bg-teal transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      {action}
    </div>
  );
}
