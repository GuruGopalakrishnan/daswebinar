import { Skeleton } from "@/components/ui/skeleton";
import { EventShell } from "./event-shell";

/** Loading state for event pages: same shape as EventView. */
export function EventPageSkeleton() {
  return (
    <EventShell>
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-[minmax(0,1fr)] gap-10 px-4 pt-8 pb-24 md:px-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" aria-busy>
        <div className="grid gap-6">
          <Skeleton className="aspect-video rounded-[18px]" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-[28rem] rounded-xl" />
      </div>
    </EventShell>
  );
}
