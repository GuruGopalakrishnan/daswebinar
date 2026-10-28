import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { WebinarForm } from "@/components/webinar/webinar-form";
import { requireUser } from "@/lib/auth";
import { getMyPlan } from "@/lib/billing/server";
import { FREE_WEBINAR_LIMIT } from "@/lib/billing/plans";

export const metadata: Metadata = { title: "New webinar" };

export default function NewWebinarPage() {
  return (
    <div className="mx-auto w-full max-w-[1264px] px-4 py-7 md:px-8">
      <PageHeader
        className="mb-6"
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Create webinar" }]}
        title="Create a webinar"
        description="Five short steps. On the last one you can publish it or save it as a draft."
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <NewWebinarContent />
      </Suspense>
    </div>
  );
}

async function NewWebinarContent() {
  await requireUser("/dashboard/webinars/new");
  const plan = await getMyPlan();
  // Same rule as the database trigger, checked up front so nobody fills in the
  // whole wizard only to be stopped at the end. The trigger still decides.
  const atLimit = plan.plan === "free" && Math.max(plan.webinarCount, plan.webinarsRun) >= FREE_WEBINAR_LIMIT;

  if (atLimit) {
    return (
      <div className="rounded-xl border border-border/85 bg-card shadow-card">
        <EmptyState
          icon={Sparkles}
          title="You've used your free webinar"
          description="The Free plan includes one webinar. Upgrade to Pro to create as many as you like, with unlimited attendees."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild cta>
                <Link href="/upgrade">
                  <Sparkles /> See Pro
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          }
          className="py-16"
        />
      </div>
    );
  }

  return <WebinarForm />;
}
