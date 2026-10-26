"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Radio, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { WebinarStatus } from "@/lib/webinars/types";

/** Primary room action for the host: open the green room, or rejoin if live. */
export function GoLiveButton({ webinarId, status }: { webinarId: string; status: WebinarStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (status === "live") {
    return (
      <Button asChild className="bg-live text-white hover:bg-live/90">
        <Link href={`/room/${webinarId}`}>
          <Radio /> Return to live room
        </Link>
      </Button>
    );
  }
  if (status === "ended" || status === "cancelled") return null;

  async function openRoom() {
    setPending(true);
    // Drafts must be published (scheduled) before the room opens to attendees.
    if (status === "draft") {
      const res = await fetch(`/api/webinars/${webinarId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "scheduled" }),
      });
      if (!res.ok) {
        setPending(false);
        toast.error("Couldn't publish this draft.");
        return;
      }
    }
    router.push(`/room/${webinarId}`);
  }

  return (
    <Button onClick={openRoom} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Video />}
      {status === "draft" ? "Publish & open room" : "Open green room"}
    </Button>
  );
}
