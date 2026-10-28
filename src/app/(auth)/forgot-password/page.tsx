import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { requestPasswordReset } from "../actions";
import { AuthForm } from "../auth-form";
import { AuthHeading, authLinkClass } from "../auth-heading";
import { ExpiredLink } from "../expired-link";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  return (
    <>
      <Suspense fallback={null}>
        <LinkError searchParams={searchParams} />
      </Suspense>

      <AuthHeading title="Reset your password">Enter your account email and we&apos;ll send you a reset link.</AuthHeading>

      <AuthForm
        action={requestPasswordReset}
        submitLabel="Send reset link"
        pendingLabel="Sending…"
        fields={[{ name: "email", label: "Email address", type: "email", autoComplete: "email", placeholder: "you@example.com" }]}
      />

      <Link href="/login" className={`inline-flex w-fit items-center gap-1.5 text-sm ${authLinkClass}`}>
        <ArrowLeft aria-hidden className="size-3.5" /> Back to sign in
      </Link>
    </>
  );
}

/** /auth/callback sends failed or expired reset links here with ?error=link. */
async function LinkError({ searchParams }: Pick<PageProps<"/forgot-password">, "searchParams">) {
  const params = await searchParams;
  if (params.error !== "link") return null;
  return <ExpiredLink />;
}
