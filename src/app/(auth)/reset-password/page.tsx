import { Suspense } from "react";
import type { Metadata } from "next";
import { getCurrentUser, isGuest } from "@/lib/auth";
import { updatePassword } from "../actions";
import { AuthForm } from "../auth-form";
import { AuthHeading } from "../auth-heading";
import { ExpiredLink } from "../expired-link";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

/** Reached from a reset email via /auth/callback, which has already signed the user in. */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="h-72" />}>
      <ResetForm />
    </Suspense>
  );
}

async function ResetForm() {
  const user = await getCurrentUser();
  if (!user || isGuest(user)) return <ExpiredLink action />;

  return (
    <>
      <AuthHeading title="Choose a new password">
        For <b className="font-medium text-foreground">{user.email}</b>. You&apos;ll stay signed in and go straight to your dashboard.
      </AuthHeading>
      <AuthForm
        action={updatePassword}
        submitLabel="Update password"
        pendingLabel="Updating…"
        fields={[
          { name: "password", label: "New password", type: "password", autoComplete: "new-password", meter: true },
          { name: "confirmPassword", label: "Confirm new password", type: "password", autoComplete: "new-password" },
        ]}
      />
    </>
  );
}
