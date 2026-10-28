import { Plus } from "lucide-react";
import { Ticks } from "@/components/blocks/lists";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Page-width wrapper with the prototype's gutters (16 px phones, 24 px from md). */
export function Wrap({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-4 md:px-6", className)}>{children}</div>;
}

/** Marketing section: 96 px vertical rhythm (56 px on phones). `alt` sits on a card-coloured band. */
export function Section({
  alt,
  id,
  className,
  children,
  labelledBy,
}: {
  alt?: boolean;
  id?: string;
  className?: string;
  children: React.ReactNode;
  labelledBy?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("py-14 md:py-24", alt && "border-y bg-card", className)}>
      <Wrap>{children}</Wrap>
    </section>
  );
}

/** Eyebrow + heading + lead. Use `as="h1"` once per page. */
export function SectionHead({
  overline,
  title,
  lead,
  center,
  as: H = "h2",
  id,
  className,
}: {
  overline?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  center?: boolean;
  as?: "h1" | "h2";
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-12 flex max-w-[680px] flex-col gap-3", center && "mx-auto items-center text-center", className)}>
      {overline && <span className="eyebrow">{overline}</span>}
      <H id={id} className="t-h1">
        {title}
      </H>
      {lead && <p className="t-lead text-pretty">{lead}</p>}
    </div>
  );
}

/** Marks a feature that is shown in the design but not built yet. Never remove it until the feature ships. */
export function ComingSoon({ className }: { className?: string }) {
  return (
    <Badge variant="default" className={className}>
      Coming soon
    </Badge>
  );
}

/** Two-column feature story: copy + art, art first on alternate rows. */
export function FeatureSplit({
  overline,
  title,
  text,
  points,
  art,
  flip,
  soon,
  note,
}: {
  overline: string;
  title: string;
  text: React.ReactNode;
  points: React.ReactNode[];
  art: React.ReactNode;
  flip?: boolean;
  /** The whole section describes a feature that isn't built yet. */
  soon?: boolean;
  /** Small print under the points, e.g. which part is coming soon. */
  note?: React.ReactNode;
}) {
  const copy = (
    <div className="flex min-w-0 flex-col gap-4">
      <span className="flex flex-wrap items-center gap-2">
        <span className="eyebrow">{overline}</span>
        {soon && <ComingSoon />}
      </span>
      <h2 className="t-h1">{title}</h2>
      <p className="t-lead text-pretty">{text}</p>
      <Ticks items={points} className="text-[15px]" />
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
  return (
    <Section>
      <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
        {flip ? (
          <>
            <div className="min-w-0 max-lg:order-2">{art}</div>
            {copy}
          </>
        ) : (
          <>
            {copy}
            <div className="min-w-0">{art}</div>
          </>
        )}
      </div>
    </Section>
  );
}

/** Accordion FAQ on native <details> (works without JavaScript). */
export function Faq({ items }: { items: { q: string; a: React.ReactNode }[] }) {
  return (
    <div>
      {items.map((item) => (
        <details key={item.q} className="group border-b py-[18px]">
          <summary className="flex cursor-pointer list-none justify-between gap-4 text-base font-semibold [&::-webkit-details-marker]:hidden">
            {item.q}
            <Plus aria-hidden className="mt-0.5 size-4 shrink-0 transition-transform duration-[220ms] ease-out group-open:rotate-45" />
          </summary>
          <p className="mt-2.5 max-w-[720px] text-pretty text-muted-foreground">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
