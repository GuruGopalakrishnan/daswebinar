import Link from "next/link";
import { Radio, Ticket } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import type { MyRegistration } from "@/lib/webinars/queries";
import type { RegistrationStatus } from "@/lib/webinars/types";

const REG_BADGE: Record<RegistrationStatus, { label: string; variant: "success" | "warning" | "danger" | "default" }> = {
  approved: { label: "Registered", variant: "success" },
  pending: { label: "Pending approval", variant: "warning" },
  rejected: { label: "Not approved", variant: "danger" },
  cancelled: { label: "Cancelled", variant: "default" },
};

/** Rows of the visitor's own registrations with one action each (join, waiting room or details). */
export function MyEventsList({ items, now }: { items: MyRegistration[]; now: number }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border/85 bg-card shadow-card">
        <EmptyState icon={Ticket} title="No registrations yet" description="Webinars you register for appear here." />
      </div>
    );
  }
  const upcoming = items.filter((i) => i.webinarStatus === "live" || (i.webinarStatus === "scheduled" && new Date(i.startsAt).getTime() + i.durationMinutes * 60_000 > now));
  const past = items.filter((i) => !upcoming.includes(i));
  return (
    <div className="grid gap-6">
      {[
        ["Upcoming", upcoming.sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))],
        ["Past", past],
      ].map(([label, rows]) =>
        (rows as MyRegistration[]).length ? (
          <section key={label as string} aria-label={label as string} className="overflow-hidden rounded-xl border border-border/85 bg-card shadow-card">
            <h2 className="border-b px-4 py-3 text-base font-semibold md:px-6">{label as string}</h2>
            <ul className="divide-y">
              {(rows as MyRegistration[]).map((r) => (
                <Row key={r.registrationId} r={r} />
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}

function Row({ r }: { r: MyRegistration }) {
  const live = r.webinarStatus === "live";
  const open = live || r.webinarStatus === "scheduled";
  const approved = r.registrationStatus === "approved";
  const badge = REG_BADGE[r.registrationStatus];
  return (
    <li className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-4 px-4 py-3.5 sm:grid-cols-[56px_minmax(0,1fr)_auto] md:px-6">
      <div aria-hidden className="flex size-12 flex-col items-center justify-center rounded-md border bg-card sm:size-14">
        <span className="text-[11px] tracking-[.06em] text-muted-foreground uppercase">
          {formatDateTime(r.startsAt, r.timezone, { weekday: undefined, day: undefined, hour: undefined, minute: undefined })}
        </span>
        <span className="text-lg leading-[22px] font-semibold">
          {formatDateTime(r.startsAt, r.timezone, { weekday: undefined, month: undefined, hour: undefined, minute: undefined })}
        </span>
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold">{r.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {live ? <span className="font-medium text-live">Live now</span> : <span>{formatDateTime(r.startsAt, r.timezone, { timeZoneName: "short" })}</span>}
          {r.hostName && <span>· {r.hostName}</span>}
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
      </div>
      <div className="col-start-2 flex gap-2 sm:col-start-auto">
        {open && approved ? (
          <Button asChild size="sm" className={live ? "bg-live text-white hover:bg-live/90" : undefined}>
            <Link href={`/room/${r.webinarId}`}>
              {live ? (
                <>
                  <Radio /> Join now
                </>
              ) : (
                "Join webinar"
              )}
            </Link>
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline">
            <Link href={`/register/${r.webinarId}`}>Details</Link>
          </Button>
        )}
      </div>
    </li>
  );
}
