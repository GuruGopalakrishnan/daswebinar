import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requestTime } from "@/lib/request-time";
import { RoomPreview, type RoomPreviewProps } from "./preview";

export const metadata: Metadata = { title: "Room preview", robots: { index: false } };

/*
 * DEVELOPMENT ONLY: the live room's real stage, dock, panels and chrome with labelled SAMPLE data and
 * local fake actions (no Supabase, Realtime or Agora). 404 in production.
 * ?as=host|attendee  &state=waiting|live|ended|removed  &panel=chat|qna|polls|people
 */

const STATES = ["waiting", "live", "ended", "removed"] as const;
const PANELS = ["chat", "qna", "polls", "people"] as const;

export default function RoomPreviewPage({ searchParams }: PageProps<"/dev/ui/room">) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={null}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/dev/ui/room">, "searchParams">) {
  const params = await searchParams;
  const now = await requestTime();
  const state = STATES.find((s) => s === params.state) ?? "live";
  const panel = PANELS.find((p) => p === params.panel) ?? null;
  const props: RoomPreviewProps = {
    isHost: params.as === "host",
    state,
    panel,
    empty: params.empty === "1",
    now,
  };
  return <RoomPreview {...props} />;
}
