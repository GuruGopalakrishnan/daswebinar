import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none">
        <path d="M5 7.5a2.5 2.5 0 0 1 2.5-2.5h5A2.5 2.5 0 0 1 15 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 5 16.5v-9Z" fill="currentColor" />
        <path d="m16.5 10 3.2-2.1a.5.5 0 0 1 .8.4v7.4a.5.5 0 0 1-.8.4L16.5 14v-4Z" fill="currentColor" opacity=".7" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span>Webinar Clone</span>
    </Link>
  );
}
