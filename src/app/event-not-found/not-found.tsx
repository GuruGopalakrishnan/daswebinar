import Link from "next/link";
import { Link2Off } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { EventShell } from "@/components/event/event-shell";

/** Unknown, private or draft event slug (404). */
export default function EventNotFound() {
  return (
    <EventShell>
      <div className="mx-auto w-full max-w-[640px] px-4 py-16 md:px-6">
        <div className="rounded-xl border border-border/85 bg-card shadow-card">
          <EmptyState
            icon={Link2Off}
            title="This link is not valid"
            description="The event may have been removed or made private, or the link was copied incorrectly. Ask the host for a new link."
            action={
              <Button asChild variant="outline">
                <Link href="/">Go to Deploy &amp; Grow</Link>
              </Button>
            }
          />
        </div>
      </div>
    </EventShell>
  );
}
