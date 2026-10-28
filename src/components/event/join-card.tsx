import Link from "next/link";
import { ArrowRight, CalendarDays, Clock, Hourglass, Radio, XCircle } from "lucide-react";
import { Callout } from "@/components/blocks/callout";
import { LocalTime } from "@/components/register/local-time";
import { Badge, PingDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RegistrationStatus, WebinarStatus } from "@/lib/webinars/types";

/** get_join_preview row. */
export type JoinPreview = {
  webinar_id: string;
  title: string;
  starts_at: string;
  timezone: string;
  status: WebinarStatus;
  host_name: string | null;
  attendee_name: string;
  registration_status: RegistrationStatus;
};

/** The join card. `action` claims the registration and enters the room; without it the button is inert (previews). */
export function JoinCard({ preview, error, action }: { preview: JoinPreview; error?: string; action?: () => Promise<void> }) {
  const closed = preview.status === "ended" || preview.status === "cancelled";
  const approved = preview.registration_status === "approved";
  const live = preview.status === "live";

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border/85 bg-card p-6 shadow-elevated md:p-8">
      <div className="flex flex-col gap-2">
        <span className="eyebrow">Your personal join link</span>
        {live && (
          <Badge variant="live" className="w-fit">
            <PingDot /> Live now
          </Badge>
        )}
        <h1 className="t-h2">{preview.title}</h1>
        {preview.host_name && <p className="text-muted-foreground">Hosted by {preview.host_name}</p>}
      </div>

      <div className="flex items-start gap-2.5 rounded-lg bg-surface-2 p-3 text-sm">
        <CalendarDays aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <LocalTime iso={preview.starts_at} webinarTimeZone={preview.timezone} />
      </div>

      {error && <Callout tone="danger">{error}</Callout>}

      {closed ? (
        <Callout icon={Clock} title={preview.status === "ended" ? "This webinar has ended" : "This webinar was cancelled"}>
          The room is closed.
        </Callout>
      ) : preview.registration_status === "pending" ? (
        <Callout tone="warn" icon={Hourglass} title="Waiting for the host's approval">
          You can join as soon as the host approves your registration. We&apos;ll email you when that happens.
        </Callout>
      ) : !approved ? (
        <Callout tone="danger" icon={XCircle} title="This registration isn't active">
          The host has removed or declined it. Contact the host if you think this is a mistake.
        </Callout>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <p className="text-sm">
            Joining as <b className="font-semibold">{preview.attendee_name}</b>
          </p>
          <Button type="submit" size="lg" className={live ? "w-full bg-live text-white hover:bg-live/90" : "w-full"}>
            {live ? (
              <>
                <Radio /> Join live now
              </>
            ) : (
              <>
                Enter the waiting room <ArrowRight />
              </>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {live
              ? "You'll check your speakers first, then go straight in."
              : "Check your camera and speakers there. It becomes the live room when the host starts."}
          </p>
        </form>
      )}

      <Button asChild variant="link" size="sm" className="w-fit self-center text-muted-foreground">
        <Link href={`/register/${preview.webinar_id}`}>Webinar details</Link>
      </Button>
    </div>
  );
}
