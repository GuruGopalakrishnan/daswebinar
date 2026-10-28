import { Breadcrumbs } from "@/components/blocks/lists";
import { NextStep } from "@/components/blocks/surfaces";
import { cn } from "@/lib/utils";

/**
 * Title row for app pages: optional breadcrumbs, title + one line of context, actions on the right
 * (stacked on phones). `nextStep` is one short sentence under the header saying what to do next.
 */
export function PageHeader({
  title,
  description,
  actions,
  crumbs,
  nextStep,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  crumbs?: { label: string; href?: string }[];
  nextStep?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          {crumbs && <Breadcrumbs items={crumbs} />}
          <h1 className="text-2xl leading-8 font-semibold tracking-[-0.025em] text-balance md:text-[30px] md:leading-[38px]">{title}</h1>
          {description && <p className="mt-1.5 text-sm text-pretty text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {nextStep && <NextStep className={cn("mt-3")}>{nextStep}</NextStep>}
    </div>
  );
}
