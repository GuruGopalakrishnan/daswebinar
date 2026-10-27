import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, CalendarDays, Loader2, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocalTime } from "@/components/register/local-time";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/webinars/queries";
import type { RegistrationStatus, WebinarStatus } from "@/lib/webinars/types";
import { joinWithLink } from "./actions";

export const metadata: Metadata = { title: "Join webinar", robots: { index: false } };

type Preview = {
  webinar_id: string;
  title: string;
  starts_at: string;
  timezone: string;
  status: WebinarStatus;
  host_name: string | null;
  attendee_name: string;
  registration_status: RegistrationStatus;
};

const ERRORS: Record<string, string> = {
  claimed: "This link belongs to another account. Log in as that account, or open the link in a private window.",
  guest_disabled: "Guest joining isn't available right now. Log in or create a free account with your registration email.",
  invalid: "This join link isn't valid any more.",
};

export default function JoinPage({ params, searchParams }: PageProps<"/join/[token]">) {
  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center p-6">
      <Suspense fallback={<Loader2 className="size-6 animate-spin text-muted-foreground" />}>
        <JoinContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function JoinContent({ params, searchParams }: Pick<PageProps<"/join/[token]">, "params" | "searchParams">) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  if (!isUuid(token)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_join_preview", { p_token: token });
  const preview = (data as Preview[] | null)?.[0];
  if (!preview) notFound();

  const error = typeof query.error === "string" ? ERRORS[query.error] : undefined;
  const closed = preview.status === "ended" || preview.status === "cancelled";
  const approved = preview.registration_status === "approved";
  const live = preview.status === "live";

  return (
    <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-xl shadow-black/5">
      {live && (
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-live/15 px-2.5 py-1 text-xs font-semibold text-live">
          <Radio className="size-3.5" /> Live now
        </span>
      )}
      <h1 className="text-lg font-semibold tracking-tight">{preview.title}</h1>
      {preview.host_name && <p className="mt-1 text-sm text-muted-foreground">with {preview.host_name}</p>}
      <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <CalendarDays className="size-4" /> <LocalTime iso={preview.starts_at} webinarTimeZone={preview.timezone} />
      </p>

      {error && (
        <p role="alert" className="mt-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-left text-sm text-destructive">
          {error}
        </p>
      )}

      {closed ? (
        <p className="mt-6 text-sm text-muted-foreground">This webinar is no longer running.</p>
      ) : !approved ? (
        <p className="mt-6 text-sm text-muted-foreground">
          {preview.registration_status === "pending"
            ? "Your registration is waiting for the host's approval."
            : "This registration isn't active."}
        </p>
      ) : (
        <form action={joinWithLink.bind(null, token)} className="mt-6">
          <p className="mb-3 text-sm">
            Joining as <span className="font-medium">{preview.attendee_name}</span>
          </p>
          <Button type="submit" size="lg" className={live ? "w-full bg-live text-white hover:bg-live/90" : "w-full"}>
            {live ? "Join live now" : "Enter the waiting room"} <ArrowRight />
          </Button>
        </form>
      )}

      <Button asChild variant="link" size="sm" className="mt-3 text-muted-foreground">
        <Link href={`/register/${preview.webinar_id}`}>Webinar details</Link>
      </Button>
    </div>
  );
}
