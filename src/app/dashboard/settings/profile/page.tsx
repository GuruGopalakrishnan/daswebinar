import { Suspense } from "react";
import type { Metadata } from "next";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { Skeleton } from "@/components/ui/skeleton";
import { requestPasswordReset, signOut } from "@/app/(auth)/actions";
import { requireUser } from "@/lib/auth";
import { getMyPlan } from "@/lib/billing/server";
import { updateProfile } from "../actions";

export const metadata: Metadata = { title: "Account settings" };

export default function ProfileSettingsPage() {
  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-7 md:px-8">
      <Suspense fallback={<SettingsSkeleton />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const user = await requireUser("/dashboard/settings/profile");
  const plan = await getMyPlan();
  const fullName = ((user.user_metadata?.full_name as string | undefined) ?? "").trim();
  return (
    <ProfileSettings
      userId={user.id}
      fullName={fullName}
      email={user.email ?? ""}
      plan={plan.plan}
      updateProfile={updateProfile}
      requestPasswordReset={requestPasswordReset}
      signOut={signOut}
    />
  );
}

function SettingsSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading settings">
      <div className="grid gap-2">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
