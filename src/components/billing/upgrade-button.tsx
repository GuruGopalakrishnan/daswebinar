"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { PRO_PRICE_INR, formatInr } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

type CheckoutResponse = {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = { open: () => void; on: (event: string, cb: (res: { error?: { description?: string } }) => void) => void };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Couldn't load the payment window. Check your connection and try again."));
    };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Opens Razorpay Checkout for the Pro subscription. `autoStart` opens it on
 * mount (used when someone picked Pro on the landing page before signing up).
 */
export function UpgradeButton({
  className,
  label = `Upgrade to Pro · ${formatInr(PRO_PRICE_INR)}/mo`,
  autoStart = false,
  size = "default",
}: {
  className?: string;
  label?: string;
  autoStart?: boolean;
  size?: "default" | "lg" | "sm";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  async function start() {
    setBusy(true);
    try {
      const [res] = await Promise.all([fetch("/api/billing/subscribe", { method: "POST" }), loadCheckout()]);
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        if (json?.error?.code === "already_subscribed") router.refresh();
        toast.error(json?.error?.message ?? "Couldn't start checkout.");
        setBusy(false);
        return;
      }
      const { keyId, subscriptionId, name, email } = json.data as { keyId: string; subscriptionId: string; name: string; email: string };

      const rzp = new window.Razorpay!({
        key: keyId,
        subscription_id: subscriptionId,
        name: BRAND.name,
        description: `Pro plan · ${formatInr(PRO_PRICE_INR)} per month`,
        prefill: { name, email },
        theme: { color: "#0f766e" },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (payment: CheckoutResponse) => {
          const verify = await fetch("/api/billing/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentId: payment.razorpay_payment_id,
              subscriptionId: payment.razorpay_subscription_id,
              signature: payment.razorpay_signature,
            }),
          });
          const result = await verify.json().catch(() => null);
          setBusy(false);
          if (!verify.ok) {
            toast.error(result?.error?.message ?? "Payment received, but we couldn't confirm it yet. It'll update in a minute.");
            return;
          }
          toast.success("Welcome to Pro!", { description: "Unlimited webinars and attendees are now on." });
          router.replace("/dashboard/billing?upgraded=1");
          router.refresh();
        },
      });
      rzp.on("payment.failed", (r) => toast.error(r.error?.description ?? "The payment didn't go through. Try another method."));
      rzp.open();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start checkout.");
      setBusy(false);
    }
  }

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      void start();
    }
    // start() is stable enough for a one-time auto open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <Button onClick={() => void start()} disabled={busy} size={size} className={cn(className)}>
      {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
      {label}
    </Button>
  );
}
