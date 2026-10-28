import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Deploy & Grow buttons. One `default` (navy) button per screen is the primary action; add `cta` to the
// screen's main next step so it reads first. `teal` is secondary emphasis, never a second primary.
const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-transparent text-sm font-medium whitespace-nowrap outline-none transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-[220ms] ease-out active:not-disabled:translate-y-px active:not-disabled:scale-[0.985] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-45 disabled:saturate-[.6] aria-disabled:pointer-events-none aria-disabled:opacity-45 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_rgb(24_38_56/0.12),inset_0_1px_0_rgb(255_255_255/0.08)] hover:bg-[color-mix(in_oklch,var(--primary)_88%,var(--background))] hover:shadow-[0_4px_12px_-4px_color-mix(in_oklch,var(--primary)_55%,transparent)]",
        destructive:
          "bg-destructive text-white shadow-[0_1px_2px_rgb(24_38_56/0.12),inset_0_1px_0_rgb(255_255_255/0.08)] hover:bg-[color-mix(in_oklch,var(--destructive)_88%,var(--background))] focus-visible:outline-destructive dark:text-primary-foreground",
        success: "bg-success text-white shadow-[0_1px_2px_rgb(24_38_56/0.12)] hover:bg-success/90",
        teal: "border-[color-mix(in_oklch,var(--teal)_30%,transparent)] bg-teal-subtle text-teal hover:bg-[color-mix(in_oklch,var(--teal-subtle)_70%,var(--teal)_12%)]",
        outline:
          "border-border bg-card text-foreground shadow-xs hover:border-[color-mix(in_oklch,var(--input)_60%,var(--border))] hover:bg-surface-2",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        link: "h-auto! px-0! text-teal underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 has-[>svg]:px-3 max-md:min-h-10",
        xs: "h-7 gap-1 px-2 text-xs has-[>svg]:px-1.5 max-md:min-h-9 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5 max-md:min-h-9",
        lg: "h-11 px-5 text-[15px] has-[>svg]:px-4 max-md:min-h-12",
        icon: "size-9",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
      cta: {
        true: "min-w-[180px]",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      cta: false,
    },
  }
)

function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
    />
  )
}

function Button({
  className,
  variant = "default",
  size = "default",
  cta = false,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Shows a spinner, sets aria-busy and blocks clicks. Ignored with asChild. */
    loading?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"
  const busy = loading && !asChild

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, cta, className }))}
      disabled={busy || disabled}
      aria-busy={busy || undefined}
      {...props}
    >
      {busy ? (
        <>
          <Spinner />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  )
}

export { Button, buttonVariants, Spinner }
