"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Ticks } from "@/components/blocks/lists";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FREE_ATTENDEE_LIMIT, PLANS, PRO_PRICE_INR, formatInr } from "@/lib/billing/plans";

export type UpgradeReason = "webinars" | "live" | "attendees";

const COPY: Record<UpgradeReason, { title: string; body: string }> = {
  webinars: {
    title: "You've used your free webinar",
    body: "The Free plan includes one webinar. Pro lets you create as many as you like.",
  },
  live: {
    title: "Your free live session is used",
    body: "On Free you can run one webinar live. Upgrade to Pro to go live again, as often as you want.",
  },
  attendees: {
    title: `This webinar has reached ${FREE_ATTENDEE_LIMIT} attendees`,
    body: `Free webinars take up to ${FREE_ATTENDEE_LIMIT} registrations. Pro removes the cap, so nobody gets turned away.`,
  },
};

/** Shown when a Free plan limit stops an action. The only action leads to the real upgrade page. */
export function UpgradeDialog({
  reason,
  onOpenChange,
}: {
  reason: UpgradeReason | null;
  onOpenChange: (open: boolean) => void;
}) {
  const copy = reason ? COPY[reason] : null;
  return (
    <Dialog open={reason !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span aria-hidden className="mb-2 flex size-11 items-center justify-center rounded-xl bg-teal-subtle text-teal">
            <Sparkles className="size-5" />
          </span>
          <DialogTitle className="t-h3">{copy?.title}</DialogTitle>
          <DialogDescription>{copy?.body}</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border bg-surface-2 p-4">
          <p className="flex items-baseline gap-1.5">
            <span className="text-[28px] leading-9 font-semibold tracking-[-0.025em] tabular-nums">{formatInr(PRO_PRICE_INR)}</span>
            <span className="text-sm text-muted-foreground">/ month · cancel any time</span>
          </p>
          <Ticks className="mt-3" items={[...PLANS.pro.features]} />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button asChild>
            <Link href="/upgrade">
              <Sparkles /> See Pro
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
