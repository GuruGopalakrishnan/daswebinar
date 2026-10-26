import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarNav, SidebarNavFallback } from "@/components/dashboard/sidebar-nav";
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar";
import { UserMenu } from "@/components/dashboard/user-menu";
import { requireUser } from "@/lib/auth";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-14 items-center px-4">
          <Logo href="/dashboard" />
        </div>
        <div className="flex-1 px-3 py-2">
          <Suspense fallback={<SidebarNavFallback />}>
            <SidebarNav />
          </Suspense>
        </div>
        <div className="border-t p-2">
          <Suspense fallback={<Skeleton className="h-10 w-full" />}>
            <SidebarUser />
          </Suspense>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <MobileSidebar />
          <div className="lg:hidden">
            <Logo href="/dashboard" />
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

async function SidebarUser() {
  const user = await requireUser("/dashboard");
  const name = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email?.split("@")[0] || "You";
  return <UserMenu id={user.id} name={name} email={user.email ?? ""} />;
}
