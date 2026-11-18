import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { PlanBox } from "@/components/dashboard/plan-box";
import { UserMenu } from "@/components/dashboard/user-menu";
import type { MyPlan } from "@/lib/billing/plans";
import { PreviewBar } from "../preview-bar";
import { SettingsPreview, type State } from "./preview";

export const metadata: Metadata = { title: "Settings preview", robots: { index: false } };

/*
 * DEVELOPMENT ONLY: the real account settings view with labelled SAMPLE data and fake actions (nothing is
 * saved, no email is sent). 404 in production.
 */

const STATES = ["default", "save-error", "reset-limited", "pro"] as const satisfies readonly State[];

export default function SettingsPreviewPage({ searchParams }: PageProps<"/dev/ui/settings">) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={null}>
      <Preview searchParams={searchParams} />
    </Suspense>
  );
}

async function Preview({ searchParams }: Pick<PageProps<"/dev/ui/settings">, "searchParams">) {
  const params = await searchParams;
  const state: State = (STATES as readonly string[]).includes(params.state as string) ? (params.state as State) : "default";
  const plan: MyPlan = {
    plan: state === "pro" ? "pro" : "free",
    status: state === "pro" ? "active" : null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    webinarCount: 1,
    webinarsRun: 1,
    attendeeCap: state === "pro" ? null : 100,
  };
  return (
    <AppShell
      foot={
        <>
          <PlanBox plan={plan} />
          <UserMenu id="sample-host" name="Ananya Rao" email="ananya@example.com" />
        </>
      }
    >
      <PreviewBar base="/dev/ui/settings" states={STATES} current={state} />
      <div className="mx-auto w-full max-w-[860px] px-4 py-7 md:px-8">
        <SettingsPreview state={state} />
      </div>
    </AppShell>
  );
}
