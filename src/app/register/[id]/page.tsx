import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EventShell } from "@/components/event/event-shell";
import { EventPageSkeleton } from "@/components/event/event-skeleton";
import { EventView } from "@/components/event/event-view";
import { loadEventPage } from "@/components/event/load";
import { getPublicWebinar, isUuid } from "@/lib/webinars/queries";

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

/** Registration page by webinar id: the link in every email so far. Works for public and unlisted webinars. */
export default function RegisterPage({ params }: PageProps<"/register/[id]">) {
  return (
    <Suspense fallback={<EventPageSkeleton />}>
      <RegisterContent params={params} />
    </Suspense>
  );
}

async function RegisterContent({ params }: Pick<PageProps<"/register/[id]">, "params">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const webinar = await getPublicWebinar(id);
  if (!webinar) notFound();
  const props = await loadEventPage(webinar, `/register/${id}`);
  return (
    <EventShell hostName={webinar.hostName} sessionNav={props.hasSession}>
      <EventView {...props} />
    </EventShell>
  );
}

