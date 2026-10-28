import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Deploy & Grow status pills (22 px). `sample` marks example or simulated data and must never be dropped.
const badgeVariants = cva(
  "inline-flex h-[22px] w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full px-2 text-xs leading-4 font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-secondary text-foreground shadow-[inset_0_0_0_1px_var(--border)]",
        teal: "bg-teal-subtle text-teal shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--teal)_30%,transparent)]",
        success: "bg-success-subtle text-success shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--success)_30%,transparent)]",
        warning: "bg-warning-subtle text-warning-text shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--warning)_50%,transparent)]",
        danger: "bg-destructive-subtle text-destructive shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--destructive)_30%,transparent)]",
        live: "bg-live font-semibold text-white dark:text-primary-foreground",
        navy: "bg-primary text-primary-foreground",
        sample:
          "h-5 bg-warning-subtle text-[11px] font-semibold tracking-[0.06em] text-warning-text uppercase shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--warning)_50%,transparent)]",
        // shadcn names kept for compatibility
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive-subtle text-destructive shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--destructive)_30%,transparent)]",
        outline: "text-foreground shadow-[inset_0_0_0_1px_var(--border)] [a&]:hover:bg-accent",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-teal underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

/** Pulsing dot for "live" badges. */
function PingDot({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("relative inline-block size-1.5 rounded-full bg-current", className)}>
      <span className="absolute inset-0 animate-[dot-ping_1.2s_cubic-bezier(0,0,.2,1)_infinite] rounded-full bg-current motion-reduce:hidden" />
    </span>
  )
}

export { Badge, badgeVariants, PingDot }
