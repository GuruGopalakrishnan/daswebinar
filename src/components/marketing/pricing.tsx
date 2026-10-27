import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS, formatInr } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

const CTA = {
  free: { label: "Start free", href: "/signup" },
  pro: { label: "Go Pro", href: "/signup?plan=pro" },
} as const;

/** Static pricing cards (server component, no client JS). */
export function Pricing() {
  return (
    <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
      {(["free", "pro"] as const).map((id) => {
        const plan = PLANS[id];
        const pro = id === "pro";
        return (
          <div
            key={id}
            className={cn(
              "relative flex flex-col rounded-3xl border p-7 sm:p-8",
              pro ? "border-foreground bg-foreground text-background" : "bg-card",
            )}
          >
            {pro && (
              <span className="absolute -top-3 right-7 rounded-full bg-highlight px-3 py-1 text-xs font-medium text-black">
                Best for weekly hosts
              </span>
            )}
            <h3 className="text-lg font-medium">{plan.name}</h3>
            <p className={cn("mt-1 text-sm", pro ? "text-background/70" : "text-muted-foreground")}>{plan.tagline}</p>
            <div className="mt-7 flex items-baseline gap-1.5">
              <span className="font-display text-6xl tracking-tight">{formatInr(plan.price)}</span>
              <span className={cn("text-sm", pro ? "text-background/70" : "text-muted-foreground")}>/ month</span>
            </div>
            <p className={cn("mt-1 text-xs", pro ? "text-background/60" : "text-muted-foreground")}>
              {pro ? "Billed monthly via Razorpay · cancel any time" : "Free forever · no card needed"}
            </p>
            <Button
              asChild
              size="lg"
              className={cn(
                "mt-7 rounded-full",
                pro ? "bg-background text-foreground hover:bg-background/90" : "",
              )}
              variant={pro ? "default" : "outline"}
            >
              <Link href={CTA[id].href}>{CTA[id].label}</Link>
            </Button>
            <ul className="mt-8 grid gap-3 text-sm">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2.5">
                  <Check className={cn("mt-0.5 size-4 shrink-0", pro ? "text-highlight" : "text-primary")} />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
