import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreJoinPreview } from "./preview";

export const metadata: Metadata = { title: "Pre-join preview", robots: { index: false } };

/** DEVELOPMENT ONLY: ?as=host|attendee. 404 in production. */
export default function PreJoinPreviewPage({ searchParams }: PageProps<"/dev/ui/prejoin">) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={null}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/dev/ui/prejoin">, "searchParams">) {
  const params = await searchParams;
  return <PreJoinPreview isHost={params.as === "host"} />;
}
