import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FREE_WEBINAR_LIMIT, PRO_PRICE_INR, formatInr, type MyPlan } from "@/lib/billing/plans";

/** Free webinars used, as the database counts them (a created or already-run webinar uses the slot). */
export function freeWebinarsUsed(plan: MyPlan) {
  return Math.min(FREE_WEBINAR_LIMIT, Math.max(plan.webinarCount, plan.webinarsRun));
}

function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

/** Sidebar plan summary from get_my_plan (the database is the source of truth for the plan). */
export function PlanBox({ plan }: { plan: MyPlan }) {
  if (plan.plan === "pro") {
    return (
      <div className="flex flex-col gap-2 rounded-xl bg-muted p-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="navy">Pro</Badge>
          <span className="text-xs text-muted-foreground">{formatInr(PRO_PRICE_INR)}/mo</span>
        </div>
        {plan.currentPeriodEnd && (
          <p className="text-xs text-muted-foreground">
            {plan.cancelAtPeriodEnd ? "Ends" : "Renews"} {formatDay(plan.currentPeriodEnd)}
          </p>
        )}
      </div>
    );
  }
  const used = freeWebinarsUsed(plan);
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-muted p-3">
      <div className="flex items-center justify-between gap-2">
        <Badge>Free plan</Badge>
        <span className="text-xs text-muted-foreground tabular-nums">
          {used} of {FREE_WEBINAR_LIMIT} used
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Free webinars used"
        aria-valuemin={0}
        aria-valuemax={FREE_WEBINAR_LIMIT}
        aria-valuenow={used}
        className="h-2 overflow-hidden rounded-full bg-background"
      >
        <span className="block h-full rounded-full bg-teal" style={{ width: `${(used / FREE_WEBINAR_LIMIT) * 100}%` }} />
      </div>
      <Button asChild size="sm" variant="teal">
        <Link href="/upgrade">Upgrade to Pro</Link>
      </Button>
    </div>
  );
}
