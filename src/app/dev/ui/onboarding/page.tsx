import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { FREE_ATTENDEE_LIMIT } from "@/lib/billing/plans";
import { OnboardingFlow } from "@/app/onboarding/onboarding-flow";

export const metadata: Metadata = { title: "Onboarding preview", robots: { index: false } };

/** DEVELOPMENT ONLY: the real onboarding flow without a session (saving needs a signed-in account). 404 in production. */
export default function OnboardingPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <AuthShell headline="A few quick questions and your workspace is ready.">
      <OnboardingFlow firstName="Ananya" freeAttendeeLimit={FREE_ATTENDEE_LIMIT} />
    </AuthShell>
  );
}
