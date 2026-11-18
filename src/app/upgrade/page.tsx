import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UpgradeView } from "@/components/billing/upgrade-view";
import { requireUser } from "@/lib/auth";
import { getMyPlan } from "@/lib/billing/server";
import { razorpayConfig } from "@/lib/billing/razorpay";

export const metadata: Metadata = { title: "Upgrade to Pro", robots: { index: false } };

export default function UpgradePage({ searchParams }: PageProps<"/upgrade">) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Logo href="/dashboard" />
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-20 sm:px-6 sm:pt-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-4" /> Back to dashboard
        </Link>
        <Suspense fallback={<Skeleton className="mt-8 h-[28rem] rounded-2xl" />}>
          <UpgradeContent searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function UpgradeContent({ searchParams }: Pick<PageProps<"/upgrade">, "searchParams">) {
  await requireUser("/upgrade");
  const [plan, params] = await Promise.all([getMyPlan(), searchParams]);
  // Checkout only appears when payments are configured: no button that can't work.
  return <UpgradeView plan={plan} paymentsReady={razorpayConfig() !== null} autoStart={params.checkout === "1"} />;
}
