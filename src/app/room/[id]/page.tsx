import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Room } from "@/components/room/room";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getHostWebinar, getMyRegistration, getPublicWebinar, isUuid } from "@/lib/webinars/queries";

export const metadata: Metadata = { title: "Live room" };

export default function RoomPage({ params }: PageProps<"/room/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <RoomContent params={params} />
    </Suspense>
  );
}

async function RoomContent({ params }: Pick<PageProps<"/room/[id]">, "params">) {
  const { id } = await params;
  const user = await requireUser(`/room/${id}`, { allowGuest: true });
  if (!isUuid(id)) notFound();

  const hosted = await getHostWebinar(id);
  if (hosted) {
    const hostName =
      ((user.user_metadata?.full_name as string | undefined) ?? "").trim() || user.email?.split("@")[0] || "Host";
    return (
      <Room
        isHost
        webinar={{
          id,
          title: hosted.title,
          hostName,
          startsAt: hosted.startsAt,
          status: hosted.status,
          startedAt: hosted.startedAt,
        }}
      />
    );
  }

  const webinar = await getPublicWebinar(id);
  if (!webinar) notFound();

  // Check access up front for a friendly message; the room's database
  // functions and Realtime channel policies enforce the same rule independently.
  const registration = await getMyRegistration(id, user.id);
  const canJoin =
    registration?.status === "approved" && (webinar.status === "scheduled" || webinar.status === "live");

  if (!canJoin) {
    const reason =
      webinar.status === "ended" || webinar.status === "cancelled"
        ? "This webinar is no longer running."
        : registration?.status === "pending"
          ? "Your registration is waiting for the host's approval."
          : "Register for this webinar to join the live room.";
    return (
      <div className="flex min-h-dvh flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center">
          <Lock className="mx-auto size-6 text-muted-foreground" />
          <h1 className="mt-3 text-lg font-semibold">{webinar.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
          <Button asChild className="mt-6 w-full">
            <Link href={`/register/${id}`}>View registration page</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Panelists get a camera and mic check before entering; the room itself
  // follows live promotions and demotions from Realtime.
  const supabase = await createClient();
  const { data: access } = await supabase.rpc("get_room_access", { p_webinar_id: id });
  const isPanelist = (access as { role?: string } | null)?.role === "panelist";

  return (
    <Room
      isHost={false}
      isPanelist={isPanelist}
      webinar={{
        id,
        title: webinar.title,
        hostName: webinar.hostName ?? "Host",
        startsAt: webinar.startsAt,
        status: webinar.status,
        startedAt: null,
      }}
    />
  );
}
