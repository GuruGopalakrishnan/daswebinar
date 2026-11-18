import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { PlanBox } from "@/components/dashboard/plan-box";
import { RecordingsHeader } from "@/components/dashboard/recordings-header";
import { UserMenu } from "@/components/dashboard/user-menu";
import type { MyPlan } from "@/lib/billing/plans";
import { requestTime } from "@/lib/request-time";
import { PreviewBar } from "../preview-bar";
import { RecordingsPreview, type State } from "./preview";

export const metadata: Metadata = { title: "Recordings preview", robots: { index: false } };

/*
 * DEVELOPMENT ONLY: the real recordings list with labelled SAMPLE rows held in memory. Nothing is read from
 * or written to this browser's recordings, and "Save file" only changes the sample row. 404 in production.
 */

const STATES = ["list", "saving", "failed", "loading", "empty", "unavailable"] as const satisfies readonly State[];

const PLAN: MyPlan = { plan: "free", status: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, webinarCount: 1, webinarsRun: 1, attendeeCap: 100 };

export default function RecordingsPreviewPage({ searchParams }: PageProps<"/dev/ui/recordings">) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={null}>
      <Preview searchParams={searchParams} />
    </Suspense>
  );
}

async function Preview({ searchParams }: Pick<PageProps<"/dev/ui/recordings">, "searchParams">) {
  const params = await searchParams;
  const state: State = STATES.includes(params.state as State) ? (params.state as State) : "list";
  return (
    <AppShell
      foot={
        <>
          <PlanBox plan={PLAN} />
          <UserMenu id="sample-host" name="Ananya Rao" email="ananya@example.com" />
        </>
      }
    >
      <PreviewBar base="/dev/ui/recordings" states={STATES} current={state} />
      <div className="mx-auto w-full max-w-[1100px] px-4 py-7 md:px-8">
        <RecordingsHeader />
        <div className="mt-6">
          <RecordingsPreview state={state} now={await requestTime()} />
        </div>
      </div>
    </AppShell>
  );
}
