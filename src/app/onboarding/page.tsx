import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { buildOnboardingSteps } from "@/components/dashboard/onboarding-steps";
import { requireUser } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { getMyPlan } from "@/lib/billing/server";
import { listHostWebinars } from "@/lib/webinars/queries";
import { requestTime } from "@/lib/request-time";

export const metadata: Metadata = { title: "Welcome", robots: { index: false } };

/** Where a new account lands after sign-up. Hosts who already have a webinar go to the dashboard. */
export default function OnboardingPage() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
        <Logo href="/dashboard" />
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-8 pb-20 sm:px-6 sm:pt-14">
        <Suspense fallback={<Skeleton className="h-[30rem] rounded-2xl" />}>
          <OnboardingContent />
        </Suspense>
      </main>
    </div>
  );
}

async function OnboardingContent() {
  const user = await requireUser("/onboarding");
  const [webinars, plan, now] = await Promise.all([listHostWebinars(user.id), getMyPlan(), requestTime()]);
  if (webinars.length > 0) redirect("/dashboard");

  const firstName = ((user.user_metadata?.full_name as string | undefined) ?? "").trim().split(/\s+/)[0] || "there";

  return (
    <>
      <p className="rise text-sm font-medium text-primary">Your account is ready</p>
      <h1 className="rise rise-1 mt-2 font-display text-5xl leading-[1.05] tracking-tight text-balance sm:text-6xl">
        Welcome to {BRAND.name}, {firstName}.
      </h1>
      <p className="rise rise-2 mt-4 max-w-xl text-pretty text-muted-foreground sm:text-lg">
        Here&apos;s the shortest path from here to your first live audience. Start with step one; the rest unlocks as you go.
      </p>
      <OnboardingChecklist steps={buildOnboardingSteps(webinars, plan, now)} className="rise rise-3 mt-10" />
      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        Skip for now and go to the dashboard <ArrowRight className="size-4" />
      </Link>
    </>
  );
}
