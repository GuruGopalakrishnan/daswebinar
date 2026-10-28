import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { WebinarForm } from "@/components/webinar/webinar-form";
import { requireUser } from "@/lib/auth";
import { getHostWebinar, isUuid } from "@/lib/webinars/queries";

export const metadata: Metadata = { title: "Edit webinar" };

export default function EditWebinarPage({ params }: PageProps<"/dashboard/webinars/[id]/edit">) {
  return (
    <div className="mx-auto w-full max-w-[1264px] px-4 py-7 md:px-8">
      <Suspense fallback={<Skeleton className="h-[480px]" />}>
        <EditContent params={params} />
      </Suspense>
    </div>
  );
}

async function EditContent({ params }: Pick<PageProps<"/dashboard/webinars/[id]/edit">, "params">) {
  const { id } = await params;
  await requireUser(`/dashboard/webinars/${id}/edit`);
  if (!isUuid(id)) notFound();
  const webinar = await getHostWebinar(id);
  if (!webinar) notFound();

  return (
    <>
      <PageHeader
        className="mb-6"
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: webinar.title, href: `/dashboard/webinars/${id}` }, { label: "Edit" }]}
        title="Edit webinar"
        description="Your changes are saved when you press Save changes on the last step."
      />
      <WebinarForm webinar={webinar} />
    </>
  );
}
