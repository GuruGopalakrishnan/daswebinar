"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, HardDriveDownload, LayoutGrid, Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon; isActive: (path: string) => boolean };

// The webinar manage pages (/dashboard/webinars/:id) belong to "Dashboard", where the list lives.
export const DASHBOARD_NAV: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutGrid,
        isActive: (p) => p === "/dashboard" || (p.startsWith("/dashboard/webinars/") && p !== "/dashboard/webinars/new"),
      },
      { href: "/dashboard/webinars/new", label: "Create webinar", icon: Plus, isActive: (p) => p === "/dashboard/webinars/new" },
      { href: "/dashboard/recordings", label: "Recordings", icon: HardDriveDownload, isActive: (p) => p === "/dashboard/recordings" },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/dashboard/billing", label: "Plan & billing", icon: CreditCard, isActive: (p) => p === "/dashboard/billing" }],
  },
];

function NavLinks({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      {DASHBOARD_NAV.map((group, gi) => (
        <div key={gi} className="flex flex-col gap-1">
          {group.label && <p className="overline px-2.5">{group.label}</p>}
          <nav aria-label={group.label ?? "Main"} className="flex flex-col gap-0.5">
            {group.items.map(({ href, label, icon: Icon, isActive }) => {
              const active = pathname !== null && isActive(pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium whitespace-nowrap transition-[background-color,color] duration-[220ms] ease-out hover:bg-accent max-lg:h-11",
                    active &&
                      "bg-teal-subtle shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--teal)_18%,transparent)] hover:bg-teal-subtle before:absolute before:inset-y-2 before:-left-3 before:w-[3px] before:rounded-r-[3px] before:bg-teal motion-safe:before:animate-[nav-ind_220ms_var(--ease-out)]",
                  )}
                >
                  <Icon aria-hidden className={cn("size-[18px] shrink-0", active ? "text-teal" : "text-muted-foreground")} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );
}

/** Same links without active state; used while the pathname streams in. */
export function SidebarNavFallback() {
  return <NavLinks pathname={null} />;
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return <NavLinks pathname={usePathname()} onNavigate={onNavigate} />;
}
