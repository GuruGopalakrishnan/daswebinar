import Link from "next/link";
import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { resendConfirmation } from "../actions";
import { AuthForm } from "../auth-form";
import { AuthHeading, authLinkClass } from "../auth-heading";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

/**
 * "Check your inbox" for accounts waiting on email confirmation, with a way to resend the link.
 * Confirmation stays link-based (Supabase); a six-digit code is planned for a later phase.
 */
export default function VerifyEmailPage() {
  return (
    <>
      <span className="grid size-16 place-items-center rounded-[20px] bg-teal-subtle text-teal shadow-card">
        <Mail aria-hidden className="size-6" />
      </span>
      <AuthHeading title="Check your email">
        We sent a confirmation link when you signed up. Open it on this device to finish setting up your account. Didn&apos;t get it? Send it
        again.
      </AuthHeading>
      <AuthForm
        action={resendConfirmation}
        submitLabel="Send confirmation link"
        pendingLabel="Sending…"
        fields={[{ name: "email", label: "Email address", type: "email", autoComplete: "email", placeholder: "you@example.com" }]}
      />
      <p className="text-sm text-muted-foreground">
        Already confirmed?{" "}
        <Link href="/login" className={authLinkClass}>
          Sign in
        </Link>
      </p>
    </>
  );
}
