import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { safeNextPath } from "@/lib/auth";
import { PRO_PRICE_INR, formatInr } from "@/lib/billing/plans";
import { signUp } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <div className="grid gap-8">
      <Suspense fallback={<div className="h-96" />}>
        <SignupContent searchParams={searchParams} />
      </Suspense>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

async function SignupContent({ searchParams }: Pick<PageProps<"/signup">, "searchParams">) {
  const params = await searchParams;
  // Picked Pro on the pricing section: open checkout right after confirming email.
  const pro = params.plan === "pro";
  const next = pro ? "/dashboard/billing?checkout=1" : safeNextPath(params.next, "/dashboard?welcome=1");

  return (
    <>
      <div className="grid gap-1.5">
        <h1 className="font-display text-3xl tracking-tight">{pro ? "Start with Pro" : "Create your account"}</h1>
        <p className="text-sm text-muted-foreground">
          {pro
            ? `Create your account, then finish payment (${formatInr(PRO_PRICE_INR)}/month). Cancel any time.`
            : "Your first webinar is free. No card needed."}
        </p>
      </div>

      <AuthForm
        action={signUp}
        next={next}
        submitLabel="Create account"
        fields={[
          { name: "fullName", label: "Name", type: "text", autoComplete: "name", placeholder: "Your full name" },
          { name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "you@example.com" },
          { name: "password", label: "Password", type: "password", autoComplete: "new-password", placeholder: "At least 8 characters" },
        ]}
      />
    </>
  );
}
