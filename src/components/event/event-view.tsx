import Link from "next/link";
import { CalendarDays, Clock, Globe, Settings2, ShieldCheck, Ticket, Users } from "lucide-react";
import { Callout } from "@/components/blocks/callout";
import { Countdown } from "@/components/countdown";
import { LocalTime } from "@/components/register/local-time";
import { MobileRegisterBar } from "@/components/register/mobile-register-bar";
import { RegisterPanel } from "@/components/register/register-panel";
import { Badge, PingDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { formatDuration } from "@/lib/format";
import type { PublicWebinarDto, RegistrationDto } from "@/lib/webinars/dto";

export type EventViewProps = {
  webinar: PublicWebinarDto;
  /** The caller's own registration (RLS), if any. */
  registration: RegistrationDto | null;
  isHost: boolean;
  /** A signed-in account (verified email); guest sessions are null. */
  account: { email: string; name: string } | null;
  /** Any session, including a guest one. */
  hasSession: boolean;
  /** The URL this page was opened on (/e/<slug> or /register/<id>), for sign-in and calendar links. */
  pagePath: string;
};

/**
 * Public event page (prototype ev-hero): details on the left, a sticky panel on the right with the schedule,
 * countdown and the one next step (register, view registration or join). Every number shown is real.
 */
export function EventView({ webinar, registration, isHost, account, hasSession, pagePath }: EventViewProps) {
  const open = webinar.status === "scheduled" || webinar.status === "live";
  const canRegister = open && !webinar.isFull && (!registration || registration.status === "cancelled");
  const live = webinar.status === "live";

  return (
    <>
      <div className="mx-auto w-full max-w-[1200px] px-4 pt-8 pb-28 md:px-6 lg:pb-24">
        {isHost && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-card">
            <span>You&apos;re the host. This is what attendees see.</span>
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/webinars/${webinar.id}`}>
                <Settings2 /> Manage
              </Link>
            </Button>
          </div>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="flex min-w-0 flex-col gap-8">
            <div className="cover c1 flex aspect-video items-end rounded-[18px] p-6" aria-hidden>
              {live ? (
                <Badge variant="live">
                  <PingDot /> Live now
                </Badge>
              ) : (
                <Badge className="bg-white/90 text-[#1c1f25] shadow-none">Live webinar</Badge>
              )}
            </div>
            <div className="flex flex-col gap-4">
              <h1 className="t-h1">{webinar.title}</h1>
              {webinar.hostName && (
                <div className="flex items-center gap-3">
                  <UserAvatar name={webinar.hostName} className="size-10 text-sm" />
                  <div>
                    <p className="font-semibold">{webinar.hostName}</p>
                    <p className="text-sm text-muted-foreground">Host</p>
                  </div>
                </div>
              )}
              <StatusNote webinar={webinar} />
              {webinar.description && <p className="max-w-prose text-base leading-6 whitespace-pre-line">{webinar.description}</p>}
            </div>
          </div>

          <aside
            id="register"
            aria-label="Registration"
            className="flex scroll-mt-20 flex-col gap-4 rounded-xl border border-border/85 bg-card p-6 shadow-elevated lg:sticky lg:top-24"
          >
            <ul className="grid gap-2.5 text-sm">
              <Fact icon={CalendarDays}>
                <LocalTime iso={webinar.startsAt} webinarTimeZone={webinar.timezone} />
              </Fact>
              <Fact icon={Clock}>{formatDuration(webinar.durationMinutes)} · live session</Fact>
              <Fact icon={Globe}>Online · join from your browser</Fact>
              <Fact icon={Ticket}>Free</Fact>
              {webinar.requiresApproval && <Fact icon={ShieldCheck}>The host approves each registration</Fact>}
              {webinar.registeredCount >= 5 && <Fact icon={Users}>{webinar.registeredCount.toLocaleString("en-IN")} people registered</Fact>}
            </ul>
            {webinar.status === "scheduled" && <Countdown to={webinar.startsAt} />}
            <div className="border-t pt-4">
              <RegisterPanel
                webinar={{
                  id: webinar.id,
                  title: webinar.title,
                  description: webinar.description,
                  startsAt: webinar.startsAt,
                  durationMinutes: webinar.durationMinutes,
                  status: webinar.status,
                  isFull: webinar.isFull,
                  requiresApproval: webinar.requiresApproval,
                  customFields: webinar.customFields,
                }}
                user={account}
                hasSession={hasSession}
                existingStatus={registration?.status ?? null}
                existingJoinPath={registration ? `/join/${registration.joinToken}` : null}
                pagePath={pagePath}
              />
            </div>
          </aside>
        </div>
      </div>

      {canRegister && <MobileRegisterBar targetId="register" live={live} startsAt={webinar.startsAt} timeZone={webinar.timezone} />}
    </>
  );
}

function Fact({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">{children}</div>
    </li>
  );
}

function StatusNote({ webinar }: { webinar: PublicWebinarDto }) {
  if (webinar.status === "cancelled") {
    return (
      <Callout tone="danger" title="This webinar was cancelled">
        Registration is closed.
      </Callout>
    );
  }
  if (webinar.status === "ended") {
    return <Callout title="This webinar has ended">Registration is closed. Registrants can watch a replay if the host shares one.</Callout>;
  }
  if (webinar.isFull) {
    return (
      <Callout tone="warn" title="This webinar is full">
        All seats are taken. Registration is closed.
      </Callout>
    );
  }
  return null;
}
