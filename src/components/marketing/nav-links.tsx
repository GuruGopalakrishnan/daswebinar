"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];

/** Marketing nav links with the current page marked (aria-current). */
export function NavLinks({ className, linkClassName, onNavigate }: { className?: string; linkClassName?: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={className}>
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={pathname === item.href ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors duration-[220ms] hover:bg-accent aria-[current=page]:bg-accent",
            linkClassName,
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
