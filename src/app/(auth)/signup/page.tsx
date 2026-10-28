import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { safeNextPath } from "@/lib/auth";
import { PRO_PRICE_INR, formatInr } from "@/lib/billing/plans";
import { signUp } from "../actions";
import { AuthForm } from "../auth-form";
import { AuthHeading, authLinkClass } from "../auth-heading";

export const metadata: Metadata = { title: "Create your account" };

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <Suspense fallback={<div className="h-[28rem]" />}>
      <SignupContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SignupContent({ searchParams }: Pick<PageProps<"/signup">, "searchParams">) {
  const params = await searchParams;
  // Picked Pro on the pricing section: open checkout right after confirming email.
  const pro = params.plan === "pro";
  const next = pro ? "/upgrade?checkout=1" : safeNextPath(params.next, "/onboarding");

  return (
    <>
      <AuthHeading title={pro ? "Start with Pro" : "Create your account"}>
        {pro
          ? `Create your account, confirm your email, then finish payment (${formatInr(PRO_PRICE_INR)}/month). Cancel any time.`
          : "Free plan, no card needed."}{" "}
        Already have an account?{" "}
        <Link href={next === "/onboarding" ? "/login" : `/login?next=${encodeURIComponent(next)}`} className={authLinkClass}>
          Sign in
        </Link>
      </AuthHeading>

      <AuthForm
        action={signUp}
        next={next}
        success="check-email"
        submitLabel="Create account"
        pendingLabel="Creating account…"
        fields={[
          { name: "fullName", label: "Full name", type: "text", autoComplete: "name" },
          { name: "email", label: "Email address", type: "email", autoComplete: "email", placeholder: "you@example.com" },
          { name: "password", label: "Password", type: "password", autoComplete: "new-password", meter: true },
        ]}
      />
    </>
  );
}
