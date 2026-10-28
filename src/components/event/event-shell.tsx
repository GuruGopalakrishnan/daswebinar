import Link from "next/link";
import { Logo } from "@/components/brand/logo";

/** Frame for attendee-facing pages (event, join, My events): host name, "Hosted on", "Powered by". */
export function EventShell({ hostName, sessionNav, children }: { hostName?: string | null; sessionNav?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b bg-[color-mix(in_oklch,var(--background)_92%,transparent)] pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-4 px-4 md:px-6">
          {hostName ? <b className="truncate font-semibold">{hostName}</b> : <Logo />}
          <div className="ml-auto flex items-center gap-3 text-sm">
            {sessionNav && (
              <Link href="/my-events" className="font-medium text-teal underline-offset-4 hover:underline">
                My events
              </Link>
            )}
            <span className="text-muted-foreground max-sm:hidden">Hosted on Deploy &amp; Grow</span>
          </div>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-8 text-xs text-muted-foreground md:px-6">
        <span>Free webinars, registration pages and join links.</span>
        <span className="inline-flex items-center gap-2">
          Powered by <Logo className="text-[13px] text-foreground" />
        </span>
      </footer>
    </div>
  );
}
