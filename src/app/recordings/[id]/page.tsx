import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { ReplayView } from "@/components/player/replay-view";
import { requireUser } from "@/lib/auth";
import { getHostWebinar, getPublicWebinar, getRecording, isUuid, listRecordings } from "@/lib/webinars/queries";

export const metadata: Metadata = { title: "Replay" };

export default function RecordingPage({ params }: PageProps<"/recordings/[id]">) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo href="/dashboard" />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <Suspense fallback={<RecordingSkeleton />}>
          <RecordingContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function RecordingContent({ params }: Pick<PageProps<"/recordings/[id]">, "params">) {
  const { id } = await params;
  await requireUser(`/recordings/${id}`, { allowGuest: true });
  if (!isUuid(id)) notFound();

  // RLS: only the host and approved registrants can read a recording.
  const recording = await getRecording(id);
  if (!recording) notFound();

  const [hosted, publicView, all] = await Promise.all([
    getHostWebinar(recording.webinarId),
    getPublicWebinar(recording.webinarId),
    listRecordings(recording.webinarId),
  ]);
  const webinarTitle = hosted?.title ?? publicView?.title ?? "Webinar";
  const timezone = hosted?.timezone ?? publicView?.timezone;
  const description = hosted?.description ?? publicView?.description;
  const hostName = publicView?.hostName;
  const backHref = hosted ? `/dashboard/webinars/${recording.webinarId}` : `/register/${recording.webinarId}`;

  return (
    <ReplayView
      recording={recording}
      all={all}
      webinarTitle={webinarTitle}
      timezone={timezone}
      description={description}
      hostName={hostName}
      backHref={backHref}
    />
  );
}

function RecordingSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]" aria-busy="true" aria-label="Loading replay">
      <div className="grid content-start gap-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="aspect-video w-full rounded-xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
