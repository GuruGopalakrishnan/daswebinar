import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Check, CircleCheck, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CancelSubscriptionButton } from "@/components/billing/cancel-button";
import { requireUser } from "@/lib/auth";
import { getMyPlan } from "@/lib/billing/server";
import { FREE_ATTENDEE_LIMIT, FREE_WEBINAR_LIMIT, PLANS, formatInr } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Plan & billing" };

export default function BillingPage({ searchParams }: PageProps<"/dashboard/billing">) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl tracking-tight">Plan &amp; billing</h1>
      <p className="mt-1 text-sm text-muted-foreground">Prices in Indian Rupees, inclusive of all charges shown at checkout.</p>
      <Suspense fallback={<Skeleton className="mt-8 h-96" />}>
        <BillingContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function BillingContent({ searchParams }: Pick<PageProps<"/dashboard/billing">, "searchParams">) {
  await requireUser("/dashboard/billing");
  const [plan, params] = await Promise.all([getMyPlan(), searchParams]);
  const isPro = plan.plan === "pro";

  const periodEnd = plan.currentPeriodEnd
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(new Date(plan.currentPeriodEnd))
    : null;

  const usage = Math.max(plan.webinarCount, plan.webinarsRun);

  return (
    <div className="mt-8 grid gap-6">
      {params.upgraded === "1" && isPro && (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <CircleCheck className="size-5 text-primary" />
          <p>
            <span className="font-medium">You&apos;re on Pro.</span> Unlimited webinars and attendees are active now.
          </p>
        </div>
      )}

      <section className="rounded-2xl border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Current plan</p>
            <p className="mt-1 font-display text-3xl">{PLANS[plan.plan].name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isPro
                ? plan.cancelAtPeriodEnd
                  ? `Cancelled — Pro stays on until ${periodEnd}.`
                  : plan.status === "pending"
                    ? "Your last payment failed. Razorpay is retrying; update your payment method from the Razorpay email."
                    : `${formatInr(PLANS.pro.price)} per month · renews ${periodEnd}`
                : "Free forever. Upgrade any time."}
            </p>
          </div>
          {isPro ? (
            !plan.cancelAtPeriodEnd && periodEnd && <CancelSubscriptionButton periodEndLabel={periodEnd} />
          ) : (
            <Button asChild>
              <Link href="/upgrade">
                <Sparkles /> Upgrade to Pro · {formatInr(PLANS.pro.price)}/mo
              </Link>
            </Button>
          )}
        </div>

        {!isPro && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Meter label="Webinars" used={usage} limit={FREE_WEBINAR_LIMIT} />
            <Meter label="Attendees per webinar" used={null} limit={FREE_ATTENDEE_LIMIT} />
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {(["free", "pro"] as const).map((id) => {
          const p = PLANS[id];
          const current = plan.plan === id;
          return (
            <div key={id} className={cn("rounded-2xl border bg-card p-6", id === "pro" && "border-primary/40")}>
              <div className="flex items-center justify-between">
                <p className="font-medium">{p.name}</p>
                {current && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">Current</span>}
              </div>
              <p className="mt-3">
                <span className="font-display text-4xl">{formatInr(p.price)}</span>
                <span className="text-sm text-muted-foreground"> / month</span>
              </p>
              <ul className="mt-5 grid gap-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <p className="text-xs text-muted-foreground">
        Payments are processed securely by Razorpay (UPI, cards, net banking). Your subscription renews monthly until you
        cancel; cancelling keeps Pro until the end of the period you&apos;ve paid for.
      </p>
    </div>
  );
}

function Meter({ label, used, limit }: { label: string; used: number | null; limit: number }) {
  const pct = used === null ? 0 : Math.min(100, (used / limit) * 100);
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{used === null ? `up to ${limit}` : `${used} / ${limit}`}</span>
      </div>
      {used !== null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full", pct >= 100 ? "bg-warning" : "bg-primary")} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
