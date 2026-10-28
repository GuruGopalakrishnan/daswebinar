/**
 * Shared look for text inputs, textareas and select triggers (Deploy & Grow forms): card surface, input
 * border, soft focus ring, and a short nudge + red glow when a field becomes invalid.
 */
export const fieldStyles =
  "rounded-md border border-input bg-card text-foreground shadow-xs outline-none transition-[border-color,box-shadow] duration-[220ms] ease-out placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60 focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_color-mix(in_oklch,var(--ring)_22%,transparent)] aria-invalid:border-destructive aria-invalid:shadow-[0_0_0_3px_color-mix(in_oklch,var(--destructive)_14%,transparent)] aria-invalid:motion-safe:animate-[field-nudge_280ms_var(--ease-out)]"
