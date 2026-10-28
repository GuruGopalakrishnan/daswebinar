import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Definition list: muted labels on the left, values on the right (stacks on small phones). */
export function KeyValue({ items, className }: { items: [React.ReactNode, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[minmax(120px,180px)_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm max-[480px]:grid-cols-1 max-[480px]:gap-y-0.5", className)}>
      {items.map(([label, value], i) => (
        <div key={i} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 [overflow-wrap:anywhere] max-[480px]:mb-2">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Check-mark list for plan features and benefits. */
export function Ticks({ items, className }: { items: React.ReactNode[]; className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-2.5 text-sm", className)}>
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-teal" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Breadcrumb trail. The last item is the current page (no link). */
export function Breadcrumbs({ items, className }: { items: { label: string; href?: string }[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("mb-2 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground", className)}>
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {item.href ? (
            <Link href={item.href} className="transition-colors hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
          {i < items.length - 1 && <ChevronRight aria-hidden className="size-3.5" />}
        </span>
      ))}
    </nav>
  );
}
