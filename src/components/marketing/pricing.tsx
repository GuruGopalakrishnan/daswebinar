"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    name: "Starter",
    blurb: "For your first audience.",
    monthly: 0,
    yearly: 0,
    cta: "Start free",
    features: ["Up to 100 attendees", "Unlimited webinars", "Live chat, Q&A & polls", "Registration pages"],
  },
  {
    name: "Pro",
    blurb: "For creators and growing teams.",
    monthly: 49,
    yearly: 39,
    cta: "Start 14-day trial",
    highlighted: true,
    features: [
      "Up to 1,000 attendees",
      "Custom registration fields",
      "Approval workflows",
      "Recordings & replays",
      "Priority support",
    ],
  },
  {
    name: "Business",
    blurb: "For high-stakes events at scale.",
    monthly: 199,
    yearly: 159,
    cta: "Talk to sales",
    features: ["Up to 10,000 attendees", "Co-hosts & moderators", "API access", "SSO & audit logs", "Dedicated success manager"],
  },
];

export function Pricing() {
  const [yearly, setYearly] = useState(true);

  return (
    <div>
      <div className="mb-10 flex justify-center">
        <div role="radiogroup" aria-label="Billing period" className="relative inline-flex rounded-full border bg-card p-1 text-sm">
          {(["Monthly", "Yearly"] as const).map((label) => {
            const active = (label === "Yearly") === yearly;
            return (
              <button
                key={label}
                role="radio"
                aria-checked={active}
                onClick={() => setYearly(label === "Yearly")}
                className={cn("relative z-10 rounded-full px-4 py-1.5 transition-colors", active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {active && (
                  <motion.span layoutId="billing-pill" className="absolute inset-0 -z-10 rounded-full bg-primary" transition={{ type: "spring", bounce: 0.2, duration: 0.4 }} />
                )}
                {label}
                {label === "Yearly" && <span className={cn("ml-1.5 text-xs", active ? "opacity-90" : "text-success")}>−20%</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const price = yearly ? plan.yearly : plan.monthly;
          return (
            <div
              key={plan.name}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-6",
                plan.highlighted && "glow-primary border-primary/40",
              )}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                  Most popular
                </span>
              )}
              <h3 className="font-semibold">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.blurb}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight tabular-nums">${price}</span>
                <span className="text-sm text-muted-foreground">/ month</span>
              </div>
              <p className="mt-1 h-5 text-xs text-muted-foreground">
                {price > 0 && yearly ? `Billed $${price * 12} yearly` : price > 0 ? "Billed monthly" : "Free forever"}
              </p>
              <Button asChild className="mt-6" variant={plan.highlighted ? "default" : "outline"}>
                <Link href="/signup">{plan.cta}</Link>
              </Button>
              <ul className="mt-6 space-y-2.5 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
