import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { safeNextPath } from "@/lib/auth";
import { Callout } from "@/components/blocks/callout";
import { Separator } from "@/components/ui/separator";
import { sendMagicLink, signIn } from "../actions";
import { AuthForm } from "../auth-form";
import { AuthHeading, authLinkClass } from "../auth-heading";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <AuthHeading title="Welcome back">
        New here?{" "}
        <Link href="/signup" className={authLinkClass}>
          Create a free account
        </Link>
      </AuthHeading>
      <Suspense fallback={<div className="h-80" />}>
        <LoginForms searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function LoginForms({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const callbackError = typeof params.error === "string";
  const verified = params.verified === "1";

  return (
    <div className="grid gap-6">
      {verified && <Callout tone="success">Your email is confirmed. Sign in to continue.</Callout>}
      {callbackError && <Callout tone="danger">That sign-in link is invalid or has expired. Sign in below, or ask for a new link.</Callout>}

      <AuthForm
        action={signIn}
        next={next}
        submitLabel="Sign in"
        pendingLabel="Signing in…"
        fields={[
          { name: "email", label: "Email address", type: "email", autoComplete: "email", placeholder: "you@example.com" },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        ]}
        beforeSubmit={
          <Link href="/forgot-password" className={`-mt-1 justify-self-end text-sm ${authLinkClass}`}>
            Forgot password?
          </Link>
        }
      />

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <Separator className="flex-1" /> or <Separator className="flex-1" />
      </div>

      <AuthForm
        action={sendMagicLink}
        idPrefix="magic"
        next={next}
        variant="outline"
        submitLabel="Email me a sign-in link"
        pendingLabel="Sending…"
        fields={[{ name: "email", label: "Email address", type: "email", autoComplete: "email", placeholder: "you@example.com" }]}
      />
    </div>
  );
}
