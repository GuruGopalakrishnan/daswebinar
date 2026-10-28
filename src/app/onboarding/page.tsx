import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthShell } from "@/components/auth-shell";
import { getPlanForRender } from "@/components/dashboard/data";
import { requireUser } from "@/lib/auth";
import { FREE_ATTENDEE_LIMIT } from "@/lib/billing/plans";
import { listHostWebinars } from "@/lib/webinars/queries";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata: Metadata = { title: "Set up your account", robots: { index: false } };

/** Where a new account lands after confirming its email. Hosts who already have a webinar go to the dashboard. */
export default function OnboardingPage() {
  return (
    <AuthShell headline="A few quick questions and your workspace is ready.">
      <Suspense fallback={<Skeleton className="h-[26rem] rounded-xl" />}>
        <OnboardingContent />
      </Suspense>
    </AuthShell>
  );
}

async function OnboardingContent() {
  const user = await requireUser("/onboarding");
  const [webinars, plan] = await Promise.all([listHostWebinars(user.id), getPlanForRender()]);
  if (webinars.length > 0) redirect("/dashboard");

  const meta = user.user_metadata ?? {};
  const firstName = ((meta.full_name as string | undefined) ?? "").trim().split(/\s+/)[0] || "there";

  return (
    <OnboardingFlow
      firstName={firstName}
      freeAttendeeLimit={plan.plan === "free" ? (plan.attendeeCap ?? FREE_ATTENDEE_LIMIT) : null}
      initialWork={typeof meta.onboarding_work === "string" ? meta.onboarding_work : ""}
      initialGoal={typeof meta.onboarding_goal === "string" ? meta.onboarding_goal : ""}
    />
  );
}
