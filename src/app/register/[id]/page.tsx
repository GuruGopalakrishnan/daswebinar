import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarDays, Clock, Settings2, Users } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Countdown } from "@/components/countdown";
import { UserAvatar } from "@/components/user-avatar";
import { StatusBadge } from "@/components/webinar/status-badge";
import { LocalTime } from "@/components/register/local-time";
import { RegisterPanel } from "@/components/register/register-panel";
import { getCurrentUser } from "@/lib/auth";
import { formatDuration } from "@/lib/format";
import { getHostWebinar, getMyRegistration, getPublicWebinar, isUuid } from "@/lib/webinars/queries";

export async function generateMetadata({ params }: PageProps<"/register/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Webinar not found" };
  const webinar = await getPublicWebinar(id).catch(() => null);
  if (!webinar) return { title: "Webinar not found" };
  return {
    title: webinar.title,
    description: webinar.description?.slice(0, 160) ?? `Register for ${webinar.title}`,
    openGraph: { title: webinar.title, description: webinar.description?.slice(0, 160) ?? undefined },
  };
}

export default function RegisterPage({ params }: PageProps<"/register/[id]">) {
  return (
    <div className="relative flex min-h-dvh flex-1 flex-col">
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[520px] overflow-hidden">
        <div className="bg-dots mask-fade-b absolute inset-0 opacity-70" />
        <div className="absolute top-[-30%] left-1/4 h-[420px] w-[620px] rounded-full bg-primary/20 blur-[120px]" />
      </div>
      <header className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-20 sm:px-6 sm:pt-14">
        <Suspense fallback={<RegisterSkeleton />}>
          <RegisterContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function RegisterContent({ params }: Pick<PageProps<"/register/[id]">, "params">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [webinar, user] = await Promise.all([getPublicWebinar(id), getCurrentUser()]);
  if (!webinar) notFound();

  const [registration, hosted] = user
    ? await Promise.all([getMyRegistration(id, user.id), getHostWebinar(id)])
    : [null, null];

  const userInfo = user
    ? {
        email: user.email ?? "",
        name: ((user.user_metadata?.full_name as string | undefined) ?? "").trim(),
      }
    : null;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_400px] lg:gap-16">
      <div className="min-w-0">
        {hosted && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border bg-card/80 px-4 py-3 text-sm backdrop-blur">
            <span>You&apos;re the host. This is what attendees see.</span>
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/webinars/${id}`}>
                <Settings2 /> Manage
              </Link>
            </Button>
          </div>
        )}

        <StatusBadge status={webinar.status} />
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{webinar.title}</h1>

        {webinar.hostName && (
          <div className="mt-6 flex items-center gap-3">
            <UserAvatar name={webinar.hostName} className="size-10 text-sm" />
            <div>
              <p className="text-sm font-medium">{webinar.hostName}</p>
              <p className="text-xs text-muted-foreground">Host</p>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="flex gap-3 rounded-xl border bg-card/70 p-4 backdrop-blur sm:col-span-2">
            <CalendarDays className="mt-0.5 size-5 shrink-0 text-primary" />
            <LocalTime iso={webinar.startsAt} webinarTimeZone={webinar.timezone} />
          </div>
          <div className="flex gap-3 rounded-xl border bg-card/70 p-4 backdrop-blur">
            <Clock className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">{formatDuration(webinar.durationMinutes)}</p>
              <p className="text-sm text-muted-foreground">Live session</p>
            </div>
          </div>
        </div>

        {webinar.status === "scheduled" && (
          <div className="mt-8">
            <p className="mb-3 text-sm text-muted-foreground">Starts in</p>
            <Countdown to={webinar.startsAt} />
          </div>
        )}

        {webinar.registeredCount >= 5 && (
          <p className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" /> {webinar.registeredCount.toLocaleString()} people registered
          </p>
        )}

        {webinar.description && (
          <section className="mt-10 border-t pt-8">
            <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">About this webinar</h2>
            <div className="mt-4 max-w-prose leading-relaxed whitespace-pre-line text-foreground/90">{webinar.description}</div>
          </section>
        )}
      </div>

      <aside className="lg:sticky lg:top-8 lg:self-start">
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
          user={userInfo}
          existingStatus={registration?.status ?? null}
        />
      </aside>
    </div>
  );
}

function RegisterSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_400px] lg:gap-16" aria-busy>
      <div className="grid gap-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-14 w-3/4" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
