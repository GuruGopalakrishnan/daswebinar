import Link from "next/link";
import { Check, CircleCheck, Clock, Lock } from "lucide-react";
import { Ticks } from "@/components/blocks/lists";
import { UsageMeter } from "@/components/blocks/surfaces";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FREE_ATTENDEE_LIMIT, FREE_WEBINAR_LIMIT, PLANS, formatInr, type MyPlan } from "@/lib/billing/plans";
import { UpgradeButton } from "./upgrade-button";

/**
 * /upgrade (presentational). Checkout only renders when Razorpay is configured (`paymentsReady`), so there is
 * never a button that can't work. The payment itself is the real UpgradeButton flow.
 */
export function UpgradeView({ plan, paymentsReady, autoStart }: { plan: MyPlan; paymentsReady: boolean; autoStart: boolean }) {
  if (plan.plan === "pro") {
    return (
      <div className="mx-auto mt-10 grid max-w-md justify-items-center gap-2 rounded-2xl border bg-card p-8 text-center shadow-card">
        <span aria-hidden className="mb-2 flex size-12 items-center justify-center rounded-xl bg-success-subtle text-success">
          <CircleCheck className="size-6" />
        </span>
        <h1 className="t-h3">You&apos;re already on Pro</h1>
        <p className="text-sm text-muted-foreground">Unlimited webinars and attendees are active on your account.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/dashboard/billing">Manage your plan</Link>
        </Button>
      </div>
    );
  }

  const used = Math.max(plan.webinarCount, plan.webinarsRun);

  return (
    <div className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-x-14 lg:gap-y-10">
      {/* Phones: intro, then the price card, then the comparison table. */}
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">
        <p className="text-[11px] leading-4 font-semibold tracking-[0.06em] text-teal uppercase">Pro plan</p>
        <h1 className="t-h1 mt-2">Host every week, with no limits.</h1>
        <p className="t-lead mt-3 max-w-xl text-pretty">
          Free gives you every feature for one webinar of up to {FREE_ATTENDEE_LIMIT} people. Pro removes both limits, so
          you can run a weekly show and never turn anyone away.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <UsageMeter
            label="Webinars on Free"
            description={used >= FREE_WEBINAR_LIMIT ? "Limit reached" : `${FREE_WEBINAR_LIMIT - used} left`}
            used={used}
            limit={FREE_WEBINAR_LIMIT}
            className="[&_[role=progressbar]]:w-full"
          />
          <div className="flex flex-col justify-center rounded-xl border bg-card px-5 py-4">
            <p className="text-sm font-semibold">Attendees per webinar</p>
            <p className="text-xs text-muted-foreground">
              {FREE_ATTENDEE_LIMIT} on Free · <span className="font-medium text-teal">unlimited on Pro</span>
            </p>
          </div>
        </div>
      </div>

      <aside className="lg:sticky lg:top-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
        <div className="rounded-2xl border bg-card p-6 shadow-elevated sm:p-7">
          <div className="flex items-center justify-between gap-2">
            <p className="t-title">{PLANS.pro.name}</p>
            <Badge variant="teal">Monthly</Badge>
          </div>
          <p className="mt-3 flex items-baseline gap-1.5">
            <span className="text-5xl font-semibold tracking-[-0.035em] tabular-nums">{formatInr(PLANS.pro.price)}</span>
            <span className="text-sm text-muted-foreground">/ month</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Billed monthly · cancel any time, Pro stays on until the period ends</p>

          <Ticks className="mt-6 border-t pt-5" items={[...PLANS.pro.features]} />

          <div className="mt-7">
            {paymentsReady ? (
              <>
                <UpgradeButton size="lg" className="w-full" label="Upgrade to Pro" autoStart={autoStart} />
                <p className="mt-3 text-center text-xs text-balance text-muted-foreground">
                  <Lock aria-hidden className="mr-1 inline size-3 align-[-1px]" />
                  Secure payment by Razorpay · UPI, cards, net banking
                </p>
              </>
            ) : (
              <div role="status" className="flex gap-3 rounded-md border border-dashed bg-surface-2 p-4 text-sm">
                <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p className="text-muted-foreground">
                  <span className="font-semibold text-foreground">Online payments are opening soon.</span> Pro will be
                  available to buy right here. Your free webinar keeps working in the meantime.
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-card lg:col-start-1 lg:row-start-2 lg:self-start">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Free and Pro compared</caption>
          <thead className="bg-surface-2">
            <tr className="border-b">
              <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase md:px-5">
                What you get
              </th>
              <th scope="col" className="w-20 px-2 py-3 text-center font-medium text-muted-foreground sm:w-28">
                Free
              </th>
              <th scope="col" className="w-24 px-2 py-3 text-center font-semibold sm:w-28">
                Pro
              </th>
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
    </div>
  );
}

function Row({ label, free, pro }: { label: string; free: string | true; pro: string | true }) {
  const cell = (v: string | true, strong?: boolean) =>
    v === true ? (
      <Check className="mx-auto size-4 text-teal" aria-label="Included" />
    ) : (
      <span className={strong ? "font-semibold" : undefined}>{v}</span>
    );
  return (
    <tr>
      <th scope="row" className="px-4 py-3 font-normal md:px-5">
        {label}
      </th>
      <td className="px-2 py-3 text-center text-muted-foreground">{cell(free)}</td>
      <td className="bg-teal-subtle/40 px-2 py-3 text-center">{cell(pro, true)}</td>
    </tr>
  );
}
