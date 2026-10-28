import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { buildOnboardingSteps } from "@/components/dashboard/onboarding-steps";
import { getPlanForRender } from "@/components/dashboard/data";
import { requireUser } from "@/lib/auth";
import { listHostWebinars } from "@/lib/webinars/queries";
import { requestTime } from "@/lib/request-time";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-[1264px] px-4 py-7 md:px-8">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

async function DashboardContent() {
  const user = await requireUser("/dashboard");
  const [webinars, plan, now] = await Promise.all([listHostWebinars(user.id), getPlanForRender(), requestTime()]);
  const firstName = ((user.user_metadata?.full_name as string | undefined) ?? "").trim().split(/\s+/)[0] || "there";

  return (
    <DashboardView
      firstName={firstName}
      plan={plan}
      webinars={webinars}
      steps={buildOnboardingSteps(webinars, plan, now)}
      now={now}
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6" aria-busy>
      <div className="grid gap-2">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-16 rounded-xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}
