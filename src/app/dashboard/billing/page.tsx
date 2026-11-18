import { Suspense } from "react";
import type { Metadata } from "next";
import { BillingView } from "@/components/billing/billing-view";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";
import { getMyPlan } from "@/lib/billing/server";

export const metadata: Metadata = { title: "Plan & billing" };

export default function BillingPage({ searchParams }: PageProps<"/dashboard/billing">) {
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-7 md:px-8">
      <Suspense fallback={<BillingSkeleton />}>
        <BillingContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function BillingContent({ searchParams }: Pick<PageProps<"/dashboard/billing">, "searchParams">) {
  await requireUser("/dashboard/billing");
  const [plan, params] = await Promise.all([getMyPlan(), searchParams]);
  return <BillingView plan={plan} upgraded={params.upgraded === "1"} />;
}

function BillingSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading your plan">
      <div className="grid gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}
