import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BillingView } from "@/components/billing/billing-view";
import { UpgradeView } from "@/components/billing/upgrade-view";
import { AppShell } from "@/components/dashboard/app-shell";
import { PlanBox } from "@/components/dashboard/plan-box";
import { UserMenu } from "@/components/dashboard/user-menu";
import { Logo } from "@/components/brand/logo";
import type { MyPlan } from "@/lib/billing/plans";
import { requestTime } from "@/lib/request-time";
import { PreviewBar } from "../preview-bar";

export const metadata: Metadata = { title: "Billing preview", robots: { index: false } };

/*
 * DEVELOPMENT ONLY: the real billing and upgrade views with labelled SAMPLE plans. No payment is simulated:
 * the buttons are the real ones and call the real APIs (which need a session). 404 in production.
 */

const STATES = ["free", "free-full", "pro", "upgraded", "cancelling", "past-due", "upgrade", "upgrade-soon", "upgrade-pro"] as const;
type State = (typeof STATES)[number];

function samplePlan(state: State, now: number): MyPlan {
  const free: MyPlan = { plan: "free", status: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, webinarCount: 0, webinarsRun: 0, attendeeCap: 100 };
  const pro: MyPlan = { ...free, plan: "pro", status: "active", currentPeriodEnd: new Date(now + 20 * 86_400_000).toISOString(), attendeeCap: null, webinarCount: 4, webinarsRun: 3 };
  switch (state) {
    case "free-full":
    case "upgrade":
    case "upgrade-soon":
      return { ...free, webinarCount: 1, webinarsRun: 1 };
    case "pro":
    case "upgraded":
    case "upgrade-pro":
      return pro;
    case "cancelling":
      return { ...pro, status: "cancelled", cancelAtPeriodEnd: true };
    case "past-due":
      return { ...pro, status: "pending" };
    default:
      return free;
  }
}

export default function BillingPreviewPage({ searchParams }: PageProps<"/dev/ui/billing">) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={null}>
      <Preview searchParams={searchParams} />
    </Suspense>
  );
}

async function Preview({ searchParams }: Pick<PageProps<"/dev/ui/billing">, "searchParams">) {
  const params = await searchParams;
  const state: State = STATES.includes(params.state as State) ? (params.state as State) : "free";
  const plan = samplePlan(state, await requestTime());
  const bar = <PreviewBar base="/dev/ui/billing" states={STATES} current={state} />;

  if (state.startsWith("upgrade") && state !== "upgraded") {
    return (
      <div className="flex min-h-dvh flex-1 flex-col">
        {bar}
        <header className="mx-auto flex h-16 w-full max-w-5xl items-center px-4 sm:px-6">
          <Logo href="/dev/ui" />
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-20 sm:px-6 sm:pt-10">
          {/* autoStart is always off here: the preview never opens checkout on its own. */}
          <UpgradeView plan={plan} paymentsReady={state === "upgrade"} autoStart={false} />
        </main>
      </div>
    );
  }

  return (
    <AppShell
      foot={
        <>
          <PlanBox plan={plan} />
          <UserMenu id="sample-host" name="Ananya Rao" email="ananya@example.com" />
        </>
      }
    >
      {bar}
      <div className="mx-auto w-full max-w-[1100px] px-4 py-7 md:px-8">
        <BillingView plan={plan} upgraded={state === "upgraded"} />
      </div>
    </AppShell>
  );
}
