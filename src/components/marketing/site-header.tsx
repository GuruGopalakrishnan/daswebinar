import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";

/**
 * Fully static: no session lookup, so marketing pages are served from the edge cache and nothing can block
 * them. Signed-in visitors who click "Sign in" are sent straight to their dashboard by the proxy.
 * "Get started" is outlined so the page's own primary action stays the only navy button.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-[color-mix(in_oklch,var(--background)_92%,transparent)] pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-6 px-4 md:px-6">
        <Logo />
        <NavLinks className="hidden gap-1 min-[900px]:flex" />
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" className="hidden min-[900px]:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/signup">Get started</Link>
          </Button>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
