import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Check, CircleCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UpgradeButton } from "@/components/billing/upgrade-button";
import { requireUser } from "@/lib/auth";
import { getMyPlan } from "@/lib/billing/server";
import { razorpayConfig } from "@/lib/billing/razorpay";
import { FREE_ATTENDEE_LIMIT, FREE_WEBINAR_LIMIT, PLANS, formatInr } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Upgrade to Pro", robots: { index: false } };

export default function UpgradePage({ searchParams }: PageProps<"/upgrade">) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Logo href="/dashboard" />
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-20 sm:px-6 sm:pt-10">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
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
  const paymentsReady = razorpayConfig() !== null;

  if (plan.plan === "pro") {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-2xl border bg-card p-8 text-center shadow-card">
        <CircleCheck className="mx-auto size-8 text-primary" />
        <h1 className="mt-4 font-display text-3xl">You&apos;re already on Pro</h1>
        <p className="mt-2 text-sm text-muted-foreground">Unlimited webinars and attendees are active on your account.</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/dashboard/billing">Manage your plan</Link>
        </Button>
      </div>
    );
  }

  const webinarsUsed = Math.max(plan.webinarCount, plan.webinarsRun);

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-14">
      <div>
        <p className="text-sm font-medium text-primary">Pro plan</p>
        <h1 className="mt-2 font-display text-5xl leading-[1.05] tracking-tight text-balance sm:text-6xl">
          Host every week, with no limits.
        </h1>
        <p className="mt-4 max-w-lg text-pretty text-muted-foreground">
          Free gives you every feature for one webinar of up to {FREE_ATTENDEE_LIMIT} people. Pro removes both limits,
          so you can run a weekly show and never turn anyone away.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <UsageMeter label="Webinars on Free" used={webinarsUsed} limit={FREE_WEBINAR_LIMIT} />
          <div className="rounded-xl border bg-card p-4 shadow-card">
            <p className="text-sm text-muted-foreground">Attendees per webinar</p>
            <p className="mt-1 text-lg font-medium">
              {FREE_ATTENDEE_LIMIT} on Free <span className="text-muted-foreground">→</span> unlimited
            </p>
          </div>
        </div>

        <table className="mt-10 w-full text-left text-sm">
          <caption className="sr-only">Free and Pro compared</caption>
          <thead>
            <tr className="border-b text-muted-foreground">
              <th scope="col" className="py-3 font-normal">What you get</th>
              <th scope="col" className="w-24 py-3 text-center font-normal">Free</th>
              <th scope="col" className="w-24 py-3 text-center font-medium text-foreground">Pro</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <Row label="Webinars" free={String(FREE_WEBINAR_LIMIT)} pro="Unlimited" />
            <Row label="Attendees per webinar" free={String(FREE_ATTENDEE_LIMIT)} pro="Unlimited" />
            <Row label="Live sessions" free="1" pro="Unlimited" />
            <Row label="Chat, Q&A, polls, reactions" free pro />
            <Row label="Registration page, reminders, join links" free pro />
            <Row label="Record to your computer" free pro />
          </tbody>
        </table>
      </div>

      <aside className="lg:sticky lg:top-8 lg:self-start">
        <div className="rounded-2xl border border-foreground/10 bg-card p-6 shadow-elevated sm:p-7">
          <p className="font-medium">{PLANS.pro.name}</p>
          <p className="mt-3 flex items-baseline gap-1.5">
            <span className="font-display text-6xl tracking-tight">{formatInr(PLANS.pro.price)}</span>
            <span className="text-sm text-muted-foreground">/ month</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Billed monthly · cancel any time, Pro stays on until the period ends</p>

          <ul className="mt-6 grid gap-2.5 text-sm">
            {PLANS.pro.features.map((f) => (
              <li key={f} className="flex gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" /> {f}
              </li>
            ))}
          </ul>

          <div className="mt-7">
            {paymentsReady ? (
              <>
                <UpgradeButton size="lg" className="w-full" label="Upgrade to Pro" autoStart={params.checkout === "1"} />
                <p className="mt-3 text-center text-xs text-muted-foreground">Secure payment by Razorpay · UPI, cards, net banking</p>
              </>
            ) : (
              <div role="status" className="flex gap-3 rounded-xl border border-dashed p-4 text-sm">
                <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Online payments are opening soon.</span> Pro will be
                  available to buy right here. Your free webinar keeps working in the meantime.
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const full = used >= limit;
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          {used} / {limit}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", full ? "bg-warning" : "bg-primary")}
          style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
        />
      </div>
      {full && <p className="mt-2 text-xs text-muted-foreground">Limit reached</p>}
    </div>
  );
}

function Row({ label, free, pro }: { label: string; free: string | true; pro: string | true }) {
  const cell = (v: string | true, strong?: boolean) =>
    v === true ? <Check className="mx-auto size-4 text-primary" aria-label="Included" /> : <span className={strong ? "font-medium" : undefined}>{v}</span>;
  return (
    <tr>
      <th scope="row" className="py-3 font-normal">{label}</th>
      <td className="py-3 text-center text-muted-foreground">{cell(free)}</td>
      <td className="py-3 text-center">{cell(pro, true)}</td>
    </tr>
  );
}
