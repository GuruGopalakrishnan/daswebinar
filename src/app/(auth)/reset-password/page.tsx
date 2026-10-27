import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { getCurrentUser, isGuest } from "@/lib/auth";
import { updatePassword } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

/** Reached from a reset email via /auth/callback, which has already signed the user in. */
export default function ResetPasswordPage() {
  return (
    <div className="grid gap-8">
      <div className="grid gap-1.5">
        <h1 className="font-display text-3xl tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">You&apos;ll stay signed in and go straight to your dashboard.</p>
      </div>
      <Suspense fallback={<div className="h-52" />}>
        <ResetForm />
      </Suspense>
    </div>
  );
}

async function ResetForm() {
  const user = await getCurrentUser();
  if (!user || isGuest(user)) {
    return (
      <div className="grid gap-4">
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          This reset link has expired or has already been used.
        </p>
        <Button asChild>
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Account: <span className="font-medium text-foreground">{user.email}</span>
      </p>
      <AuthForm
        action={updatePassword}
        submitLabel="Save password and continue"
        fields={[
          { name: "password", label: "New password", type: "password", autoComplete: "new-password", placeholder: "At least 8 characters" },
          { name: "confirmPassword", label: "Confirm new password", type: "password", autoComplete: "new-password" },
        ]}
      />
    </div>
  );
}
