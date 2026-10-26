import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { WebinarForm } from "@/components/webinar/webinar-form";
import { requireUser } from "@/lib/auth";
import { getHostWebinar, isUuid } from "@/lib/webinars/queries";

export const metadata: Metadata = { title: "Edit webinar" };

export default function EditWebinarPage({ params }: PageProps<"/dashboard/webinars/[id]/edit">) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
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
      <Link
        href={`/dashboard/webinars/${id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> {webinar.title}
      </Link>
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">Edit webinar</h1>
      <WebinarForm webinar={webinar} />
    </>
  );
}
