import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EventShell } from "@/components/event/event-shell";
import { EventView } from "@/components/event/event-view";
import { loadEventPage } from "@/components/event/load";
import { EventPageSkeleton } from "@/components/event/event-skeleton";
import { getPublicWebinarBySlug } from "@/lib/webinars/queries";

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const webinar = await getPublicWebinarBySlug(slug).catch(() => null);
  if (!webinar) return { title: "Event not found", robots: { index: false } };
  return {
    title: webinar.title,
    description: webinar.description?.slice(0, 160) ?? `Register for ${webinar.title}`,
    openGraph: { title: webinar.title, description: webinar.description?.slice(0, 160) ?? undefined },
  };
}

/**
 * Friendly event link. Resolves only public, non-draft webinars (get_public_webinar_by_slug); unlisted ones
 * use /register/<id>. Registration still goes through the webinar id, with every database rule applied.
 */
export default function EventSlugPage({ params }: PageProps<"/e/[slug]">) {
  return (
    <Suspense fallback={<EventPageSkeleton />}>
      <EventContent params={params} />
    </Suspense>
  );
}

async function EventContent({ params }: Pick<PageProps<"/e/[slug]">, "params">) {
  const { slug } = await params;
  const webinar = await getPublicWebinarBySlug(slug);
  if (!webinar) notFound();
  const props = await loadEventPage(webinar, `/e/${slug.toLowerCase()}`);
  return (
    <EventShell hostName={webinar.hostName} sessionNav={props.hasSession}>
      <EventView {...props} />
    </EventShell>
  );
}

