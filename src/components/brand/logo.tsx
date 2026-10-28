import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** "D&G" monogram: navy tile with a teal ampersand. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid h-8 w-[34px] shrink-0 place-items-center rounded-md bg-primary text-[11px] font-bold tracking-[-0.04em] whitespace-nowrap text-primary-foreground",
        className,
      )}
    >
      <span>
        D<b className="font-bold text-[oklch(0.86_0.07_180)] dark:text-teal">&amp;</b>G
      </span>
    </span>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      aria-label={`${BRAND.name} home`}
      className={cn("inline-flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.02em] whitespace-nowrap", className)}
    >
      <LogoMark />
      {/* Wordmark hides on very narrow phones, like the prototype. */}
      <span className="max-[380px]:hidden">
        Deploy &amp; Grow <small className="text-[15px] font-medium text-muted-foreground">Webinar</small>
      </span>
    </Link>
  );
}
