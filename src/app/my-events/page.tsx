import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Ticket } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { EventShell } from "@/components/event/event-shell";
import { MyEventsList } from "@/components/event/my-events-list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser, isGuest } from "@/lib/auth";
import { requestTime } from "@/lib/request-time";
import { listMyRegistrations } from "@/lib/webinars/queries";

export const metadata: Metadata = { title: "My events", robots: { index: false } };

/** The visitor's own registrations (account or guest session), via list_my_registrations (user_id = auth.uid()). */
export default function MyEventsPage() {
  return (
    <EventShell>
      <div className="mx-auto w-full max-w-[880px] px-4 py-8 md:px-6">
        <Suspense fallback={<Skeleton className="h-72 rounded-xl" />}>
          <MyEventsContent />
        </Suspense>
      </div>
    </EventShell>
  );
}

async function MyEventsContent() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="rounded-xl border border-border/85 bg-card shadow-card">
        <EmptyState
          icon={Ticket}
          title="See your registrations"
          description="Sign in with the email you registered with, or open the personal join link from your confirmation email."
          action={
            <Button asChild cta>
              <Link href="/login?next=%2Fmy-events">Sign in</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const [{ available, items }, now] = await Promise.all([listMyRegistrations(), requestTime()]);
  const who = isGuest(user) ? "this browser (guest)" : user.email;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="t-h2">My events</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Registrations for {who}.</p>
      </div>
      {!available ? (
        <div className="rounded-xl border border-border/85 bg-card shadow-card">
          <EmptyState icon={Ticket} title="Not available yet" description="Use the personal join link from your confirmation email to join a webinar." />
        </div>
      ) : (
        <MyEventsList items={items} now={now} />
      )}
    </div>
  );
}
