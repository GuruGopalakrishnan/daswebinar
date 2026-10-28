import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { ManageView } from "@/components/webinar/manage-view";
import { getPlanForRender } from "@/components/dashboard/data";
import { requireUser } from "@/lib/auth";
import { getHostWebinar, getHostWebinarSlug, isUuid, listRecordings, listRegistrations } from "@/lib/webinars/queries";

export const metadata: Metadata = { title: "Manage webinar" };

export default function ManageWebinarPage({ params }: PageProps<"/dashboard/webinars/[id]">) {
  return (
    <div className="mx-auto w-full max-w-[1264px] px-4 py-7 md:px-8">
      <Suspense fallback={<ManageSkeleton />}>
        <ManageContent params={params} />
      </Suspense>
    </div>
  );
}

async function ManageContent({ params }: Pick<PageProps<"/dashboard/webinars/[id]">, "params">) {
  const { id } = await params;
  await requireUser(`/dashboard/webinars/${id}`);
  if (!isUuid(id)) notFound();

  // Another host's webinar returns null (RLS), so it 404s rather than revealing it exists.
  const webinar = await getHostWebinar(id);
  if (!webinar) notFound();
  const [registrations, recordings, plan, slug] = await Promise.all([
    listRegistrations(id),
    listRecordings(id),
    getPlanForRender(),
    getHostWebinarSlug(id),
  ]);

  return <ManageView webinar={webinar} registrations={registrations} recordings={recordings} plan={plan} slug={slug} />;
}

function ManageSkeleton() {
  return (
    <div className="grid gap-6" aria-busy>
      <Skeleton className="h-16 w-2/3" />
      <Skeleton className="h-9 w-80" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
