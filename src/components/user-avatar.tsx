import { cn } from "@/lib/utils";
import { hueFor, initials } from "@/lib/format";

/** Initials avatar with a stable per-user hue. */
export function UserAvatar({
  name,
  id,
  className,
}: {
  name: string;
  id?: string;
  className?: string;
}) {
  const hue = hueFor(id ?? name);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 shrink-0 select-none items-center justify-center rounded-full text-[11px] font-semibold text-white",
        className,
      )}
      style={{ background: `linear-gradient(135deg, oklch(0.62 0.15 ${hue}), oklch(0.5 0.15 ${(hue + 40) % 360}))` }}
    >
      {initials(name)}
    </span>
  );
}
