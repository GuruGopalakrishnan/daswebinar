"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function CancelSubscriptionButton({ periodEndLabel }: { periodEndLabel: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function cancel() {
    setBusy(true);
    const res = await fetch("/api/billing/cancel", { method: "POST" });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      toast.error(json?.error?.message ?? "Couldn't cancel. Try again.");
      return;
    }
    setOpen(false);
    toast.success("Renewal cancelled", { description: `You keep Pro until ${periodEndLabel}.` });
    router.refresh();
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          Cancel subscription
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel your Pro subscription?</AlertDialogTitle>
          <AlertDialogDescription>
            You won&apos;t be charged again. Pro stays on until {periodEndLabel}. After that your account moves to the
            free plan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep Pro</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              void cancel();
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Cancel renewal
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
