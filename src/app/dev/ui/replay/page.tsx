import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { ReplayView } from "@/components/player/replay-view";
import type { RecordingDto } from "@/lib/webinars/dto";
import { requestTime } from "@/lib/request-time";
import { PreviewBar } from "../preview-bar";

export const metadata: Metadata = { title: "Replay preview", robots: { index: false } };

/*
 * DEVELOPMENT ONLY: the real replay layout with labelled SAMPLE recordings. The sample video URL points at a
 * file that doesn't exist (nothing plays; no video is bundled). 404 in production.
 */

const STATES = ["series", "single"] as const;

export default function ReplayPreviewPage({ searchParams }: PageProps<"/dev/ui/replay">) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={null}>
      <Preview searchParams={searchParams} />
    </Suspense>
  );
}

async function Preview({ searchParams }: Pick<PageProps<"/dev/ui/replay">, "searchParams">) {
  const params = await searchParams;
  const state = params.state === "single" ? "single" : "series";
  const now = await requestTime();
  const rec = (i: number, title: string, minutes: number): RecordingDto => ({
    id: `00000000-0000-0000-0000-00000000010${i}`,
    webinarId: "00000000-0000-0000-0000-000000000001",
    title,
    videoUrl: `/dev-sample-missing-${i}.mp4`,
    durationSeconds: minutes * 60,
    createdAt: new Date(now - i * 86_400_000).toISOString(),
  });
  const all = [rec(1, "Growth Masterclass for Coaches: full session", 58), rec(2, "Growth Masterclass: Q&A only", 17)];
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <PreviewBar base="/dev/ui/replay" states={STATES} current={state} />
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
          <Logo href="/dev/ui" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <ReplayView
          recording={all[0]!}
          all={state === "single" ? [all[0]!] : all}
          webinarTitle="Growth Masterclass for Coaches"
          timezone="Asia/Kolkata"
          description={"A practical session on turning followers into booked calls.\nOne lead magnet, a three-email follow-up and a single booking link."}
          hostName="Ananya Rao"
          backHref="/dev/ui"
        />
      </main>
    </div>
  );
}
