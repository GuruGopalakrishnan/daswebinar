import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./mobile-nav";

export const NAV = [
  { href: "/#benefits", label: "Why hosts switch" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

/**
 * Fully static: no session lookup, so the landing page is served from the
 * edge cache and nothing can block it. Signed-in visitors who click "Log in"
 * are sent straight to their dashboard by the proxy.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-transparent bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-1 sm:flex">
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full px-4">
              <Link href="/signup">Start free</Link>
            </Button>
          </div>
          <MobileNav items={NAV} />
        </div>
      </div>
    </header>
  );
}
