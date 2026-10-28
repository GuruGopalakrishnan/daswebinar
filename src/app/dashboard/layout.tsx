import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/dashboard/app-shell";
import { PlanBox } from "@/components/dashboard/plan-box";
import { UserMenu } from "@/components/dashboard/user-menu";
import { getPlanForRender } from "@/components/dashboard/data";
import { requireUser } from "@/lib/auth";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <AppShell
      foot={
        <Suspense fallback={<Skeleton className="h-32 w-full rounded-xl" />}>
          <SidebarFoot />
        </Suspense>
      }
    >
      {children}
    </AppShell>
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
