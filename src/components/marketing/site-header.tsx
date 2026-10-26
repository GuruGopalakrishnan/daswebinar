import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { MobileNav } from "./mobile-nav";

export const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Suspense fallback={<div className="hidden h-8 w-40 sm:block" />}>
            <HeaderAuth />
          </Suspense>
          <MobileNav items={NAV} />
        </div>
      </div>
    </header>
  );
}

async function HeaderAuth() {
  const user = await getCurrentUser();
  if (user) {
    return (
      <Button asChild size="sm" className="hidden sm:inline-flex">
        <Link href="/dashboard">Dashboard</Link>
      </Button>
    );
  }
  return (
    <div className="hidden items-center gap-2 sm:flex">
      <Button asChild variant="ghost" size="sm">
        <Link href="/login">Log in</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/signup">Start free</Link>
      </Button>
    </div>
  );
}
