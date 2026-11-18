import Link from "next/link";
import { Badge } from "@/components/ui/badge";

/** DEVELOPMENT ONLY: the "Sample data" strip with state links at the top of a dev preview. */
export function PreviewBar({ base, param = "state", states, current }: { base: string; param?: string; states: readonly string[]; current: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-warning-subtle px-4 py-2 text-xs md:px-8">
      <Badge variant="sample">Sample data · dev preview</Badge>
      {states.map((s) => (
        <Link
          key={s}
          href={`${base}?${param}=${s}`}
          aria-current={s === current ? "page" : undefined}
          className="rounded px-2 py-1 font-medium aria-[current=page]:bg-card"
        >
          {s}
        </Link>
      ))}
    </div>
  );
}
