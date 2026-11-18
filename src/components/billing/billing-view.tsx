import Link from "next/link";
import { CalendarClock, CreditCard, ReceiptText, ShieldCheck, Sparkles } from "lucide-react";
import { Callout } from "@/components/blocks/callout";
import { KeyValue, Ticks } from "@/components/blocks/lists";
import { SectionCard, UsageMeter } from "@/components/blocks/surfaces";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FREE_ATTENDEE_LIMIT, FREE_WEBINAR_LIMIT, PLANS, formatInr, type MyPlan, type PlanId } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { CancelSubscriptionButton } from "./cancel-button";

function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

/** What the subscription is doing right now, from get_my_plan (the database is the source of truth). */
export function billingState(plan: MyPlan): "free" | "free-full" | "active" | "cancelling" | "past-due" {
  if (plan.plan === "free") return Math.max(plan.webinarCount, plan.webinarsRun) >= FREE_WEBINAR_LIMIT ? "free-full" : "free";
  if (plan.cancelAtPeriodEnd) return "cancelling";
  if (plan.status === "pending") return "past-due";
  return "active";
}

/**
 * Plan & billing (presentational). The page loads `plan` with get_my_plan(); the only actions are the real
 * upgrade page and the real cancel endpoint. No invoice list: Razorpay emails receipts, and invoice history
 * isn't built yet (backlog item 16).
 */
export function BillingView({ plan, upgraded }: { plan: MyPlan; upgraded: boolean }) {
  const state = billingState(plan);
  const isPro = plan.plan === "pro";
  const periodEnd = plan.currentPeriodEnd ? formatDay(plan.currentPeriodEnd) : null;
  const used = Math.max(plan.webinarCount, plan.webinarsRun);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Plan & billing"
        description="Your plan, what you've used and how you pay. Prices are in Indian Rupees."
        nextStep={
          state === "free-full" ? (
            <>
              Your free webinar is used. <b>Upgrade to Pro</b> to create and run more.
            </>
          ) : state === "past-due" ? (
            <>
              <b>Update your payment method</b> from the Razorpay email to keep Pro.
            </>
          ) : undefined
        }
      />

      {upgraded && isPro && (
        <Callout tone="success" title="You're on Pro">
          Unlimited webinars and attendees are active now.
        </Callout>
      )}
      {state === "past-due" && (
        <Callout tone="warn" title="Your last payment didn't go through">
          Razorpay is retrying the charge. Pro stays on while it retries; use the link in Razorpay&apos;s email to change how
          you pay.
        </Callout>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <SectionCard
          title="Current plan"
          actions={
            isPro ? (
              !plan.cancelAtPeriodEnd && periodEnd && <CancelSubscriptionButton periodEndLabel={periodEnd} />
            ) : (
              <Button asChild cta>
                <Link href="/upgrade">
                  <Sparkles /> Upgrade to Pro
                </Link>
              </Button>
            )
          }
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="t-h2">{PLANS[plan.plan].name}</p>
            <StatusBadge state={state} />
          </div>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            {state === "cancelling"
              ? `Renewal is off. Pro stays on until ${periodEnd ?? "the end of this period"}, then your account moves to Free.`
              : isPro
                ? PLANS.pro.tagline
                : "Every feature, for one webinar of up to " + FREE_ATTENDEE_LIMIT + " people. Upgrade any time."}
          </p>

          <KeyValue
            className="mt-6 border-t pt-5"
            items={[
              ["Price", isPro ? `${formatInr(PLANS.pro.price)} per month` : "Free"],
              ...(isPro && periodEnd
                ? ([[plan.cancelAtPeriodEnd ? "Pro ends on" : "Next renewal", periodEnd]] as [string, string][])
                : []),
              ["Webinars", isPro ? "Unlimited" : `${FREE_WEBINAR_LIMIT}`],
              ["Attendees per webinar", isPro ? "Unlimited" : `Up to ${FREE_ATTENDEE_LIMIT}`],
              ["Payments", isPro ? "Monthly subscription through Razorpay" : "None"],
            ]}
          />

          {!isPro && (
            <UsageMeter
              className="mt-6 bg-surface-2 max-sm:[&_[role=progressbar]]:w-full"
              label={`Free webinar used: ${Math.min(used, FREE_WEBINAR_LIMIT)} of ${FREE_WEBINAR_LIMIT}`}
              description={
                state === "free-full" ? "Limit reached. Your past webinar data stays." : "Creating a webinar uses your free slot."
              }
              used={used}
              limit={FREE_WEBINAR_LIMIT}
            />
          )}
        </SectionCard>

        <SectionCard title="Payments" bodyClassName="grid gap-4">
          <InfoRow icon={CreditCard} title="Secure checkout by Razorpay">
            UPI, cards and net banking. We never see or store your card details.
          </InfoRow>
          <InfoRow icon={ReceiptText} title="Receipts">
            Razorpay emails a receipt after every payment.
          </InfoRow>
          <InfoRow icon={CalendarClock} title="Cancel any time">
            Cancelling stops the next charge. You keep Pro until the end of the period you&apos;ve paid for.
          </InfoRow>
        </SectionCard>
      </div>

      <section aria-labelledby="compare-plans" className="grid gap-4">
        <h2 id="compare-plans" className="t-h3">
          Compare plans
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {(["free", "pro"] as const).map((id) => (
            <PlanCard key={id} id={id} current={plan.plan === id} />
          ))}
        </div>
      </section>

      <p className="flex items-start gap-2 text-xs text-pretty text-muted-foreground">
        <ShieldCheck aria-hidden className="mt-px size-3.5 shrink-0 text-teal" />
        Your subscription renews monthly until you cancel. Prices include all charges shown at checkout.
      </p>
    </div>
  );
}

function StatusBadge({ state }: { state: ReturnType<typeof billingState> }) {
  switch (state) {
    case "active":
      return <Badge variant="success">Active</Badge>;
    case "cancelling":
      return <Badge variant="warning">Renewal off</Badge>;
    case "past-due":
      return <Badge variant="danger">Payment retrying</Badge>;
    case "free-full":
      return <Badge variant="warning">Limit reached</Badge>;
    default:
      return <Badge>Current</Badge>;
  }
}

function InfoRow({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-md bg-teal-subtle text-teal">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-[13px] text-pretty text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

function PlanCard({ id, current }: { id: PlanId; current: boolean }) {
  const p = PLANS[id];
  const pro = id === "pro";
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col rounded-xl border bg-card p-5 shadow-card md:p-6",
        pro && "border-[color-mix(in_oklch,var(--teal)_45%,transparent)] shadow-[0_0_0_1px_color-mix(in_oklch,var(--teal)_20%,transparent),var(--shadow-card)]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="t-title">{p.name}</p>
        {current ? <Badge variant="navy">Your plan</Badge> : pro && <Badge variant="teal">For weekly hosts</Badge>}
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground">{p.tagline}</p>
      <p className="mt-4 flex items-baseline gap-1.5">
        <span className="text-[34px] leading-10 font-semibold tracking-[-0.025em] tabular-nums">{formatInr(p.price)}</span>
        <span className="text-sm text-muted-foreground">/ month</span>
      </p>
      <Ticks className="mt-5" items={[...p.features]} />
      {pro && !current && (
        <Button asChild variant="teal" className="mt-6 self-start">
          <Link href="/upgrade">See Pro</Link>
        </Button>
      )}
    </div>
  );
}
