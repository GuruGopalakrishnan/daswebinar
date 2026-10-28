import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarNav, SidebarNavFallback } from "@/components/dashboard/sidebar-nav";
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar";
import { PlanBox } from "@/components/dashboard/plan-box";
import { UserMenu } from "@/components/dashboard/user-menu";
import { getPlanForRender } from "@/components/dashboard/data";
import { requireUser } from "@/lib/auth";

/** App shell (Deploy & Grow): 248 px sidebar with plan box, sticky top bar, sheet navigation under 1024 px. */
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const foot = (
    <Suspense fallback={<Skeleton className="h-32 w-full rounded-xl" />}>
      <SidebarFoot />
    </Suspense>
  );
  return (
    <div className="grid min-h-dvh flex-1 grid-cols-[minmax(0,1fr)] lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside
        aria-label="Sidebar"
        className="sticky top-0 hidden h-dvh flex-col gap-4 overflow-y-auto border-r bg-sidebar px-3 py-4 lg:flex"
      >
        <div className="px-2 pt-1 pb-2">
          <Logo href="/dashboard" />
        </div>
        <Suspense fallback={<SidebarNavFallback />}>
          <SidebarNav />
        </Suspense>
        <div className="mt-auto flex flex-col gap-3">{foot}</div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-[color-mix(in_oklch,var(--background)_86%,transparent)] px-4 backdrop-blur-md md:px-8">
          <MobileSidebar foot={foot} />
          <div className="lg:hidden">
            <Logo href="/dashboard" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="max-sm:hidden">
              <Link href="/dashboard/webinars/new">
                <Plus /> New webinar
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </header>
        <main id="main" className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

async function SidebarFoot() {
  const user = await requireUser("/dashboard");
  const plan = await getPlanForRender();
  const name = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email?.split("@")[0] || "You";
  return (
    <>
      <PlanBox plan={plan} />
      <UserMenu id={user.id} name={name} email={user.email ?? ""} />
    </>
  );
}
