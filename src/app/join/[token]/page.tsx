import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EventShell } from "@/components/event/event-shell";
import { JoinCard, type JoinPreview } from "@/components/event/join-card";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/webinars/queries";
import { joinWithLink } from "./actions";

export const metadata: Metadata = { title: "Join webinar", robots: { index: false } };

const ERRORS: Record<string, string> = {
  claimed: "This link belongs to another account. Sign in as that account, or open the link in a private window.",
  guest_disabled: "Guest joining isn't available right now. Sign in or create a free account with your registration email.",
  invalid: "This join link isn't valid any more.",
};

/**
 * Personal join link (/join/<token>), sent in every confirmation and reminder email. Shows the webinar; only a
 * click (the form) claims the registration and enters the room, so email link scanners can't use it up.
 */
export default function JoinPage({ params, searchParams }: PageProps<"/join/[token]">) {
  return (
    <EventShell>
      <div className="mx-auto w-full max-w-[560px] px-4 py-12 md:px-6 md:py-16">
        <Suspense fallback={<Skeleton className="h-80 rounded-xl" />}>
          <JoinContent params={params} searchParams={searchParams} />
        </Suspense>
      </div>
    </EventShell>
  );
}

async function JoinContent({ params, searchParams }: Pick<PageProps<"/join/[token]">, "params" | "searchParams">) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  if (!isUuid(token)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_join_preview", { p_token: token });
  const preview = (data as JoinPreview[] | null)?.[0];
  if (!preview) notFound();

  const error = typeof query.error === "string" ? ERRORS[query.error] : undefined;
  return <JoinCard preview={preview} error={error} action={joinWithLink.bind(null, token)} />;
}
