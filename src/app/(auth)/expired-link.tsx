import Link from "next/link";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

/** "This reset link has expired" (prototype's expired view). `action` adds a button; otherwise the form below is the next step. */
export function ExpiredLink({ action = false }: { action?: boolean }) {
  return (
    <div role="alert" className="grid gap-2 rounded-xl border bg-card p-5 shadow-card">
      <span className="mb-1 grid size-12 place-items-center rounded-2xl bg-warning-subtle text-warning-text">
        <Clock aria-hidden className="size-5" />
      </span>
      <p className="t-title">This reset link has expired</p>
      <p className="text-sm text-muted-foreground">
        Reset links work for one hour and only once, in the browser that asked for them. Request a new one and open the latest email on
        this device.
      </p>
      {action && (
        <Button asChild cta className="mt-2 w-fit">
          <Link href="/forgot-password">Send a new link</Link>
        </Button>
      )}
    </div>
  );
}
