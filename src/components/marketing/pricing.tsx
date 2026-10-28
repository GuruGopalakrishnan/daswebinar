import Link from "next/link";
import { Ticks } from "@/components/blocks/lists";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PLANS, formatInr } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { SectionHead } from "./sections";

/**
 * Plan cards (static, no client JS). Prices and feature lists come from src/lib/billing/plans.ts; the database
 * enforces the limits and Razorpay charges the amount. Both plans have every feature, so the lists stay honest.
 */
export function Pricing({ headingAs = "h2" }: { headingAs?: "h1" | "h2" }) {
  return (
    <>
      <SectionHead
        center
        as={headingAs}
        overline="Pricing"
        title="Simple pricing in ₹"
        lead="Both plans include the full studio. Pro removes the limits."
      />
      <div className="mx-auto grid max-w-[880px] grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
        {(["free", "pro"] as const).map((id) => {
          const plan = PLANS[id];
          const pro = id === "pro";
          return (
            <div
              key={id}
              className={cn(
                "flex flex-col gap-5 rounded-xl border bg-card p-6 shadow-card transition-[box-shadow,transform] duration-[220ms] ease-out hover:-translate-y-0.5 hover:shadow-raise motion-reduce:hover:translate-y-0 md:p-8",
                pro && "border-2 border-primary shadow-raise",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="grid gap-1">
                  <h3 className="t-h3">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">{plan.tagline}</p>
                </div>
                {pro && <Badge variant="navy">Most hosts</Badge>}
              </div>
              <p className="flex items-baseline gap-1">
                <span className="text-[44px] leading-[48px] font-[650] tracking-[-0.03em] tabular-nums">{formatInr(plan.price)}</span>
                <span className="text-muted-foreground">{pro ? "/month" : "forever"}</span>
              </p>
              <Ticks items={[...plan.features]} />
              <Button asChild size="lg" variant={pro ? "default" : "outline"} className="mt-auto">
                {/* /signup?plan=pro opens Razorpay checkout right after the email is confirmed. */}
                <Link href={pro ? "/signup?plan=pro" : "/signup"}>{pro ? "Start with Pro" : "Start free"}</Link>
              </Button>
            </div>
          );
        })}
      </div>
      <p className="mx-auto mt-4 max-w-[880px] text-center text-xs text-muted-foreground">
        Billed monthly in ₹ through Razorpay. There is no annual plan. Cancel any time; Pro stays active until the end of the paid
        month. Unlimited attendees on Pro depends on available streaming capacity; we&apos;ll tell you before a session if a limit applies.
      </p>
    </>
  );
}
