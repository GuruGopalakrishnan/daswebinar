import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { safeNextPath } from "@/lib/auth";
import { Separator } from "@/components/ui/separator";
import { sendMagicLink, signIn } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="grid gap-8">
      <div className="grid gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Log in to manage your webinars.</p>
      </div>

      <Suspense fallback={<div className="h-72" />}>
        <LoginForms searchParams={searchParams} />
      </Suspense>

      <p className="text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign up free
        </Link>
      </p>
    </div>
  );
}

async function LoginForms({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const callbackError = typeof params.error === "string";

  return (
    <div className="grid gap-6">
      {callbackError && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          That sign-in link is invalid or has expired.
        </p>
      )}

      <AuthForm
        action={signIn}
        next={next}
        submitLabel="Log in"
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "you@company.com" },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        ]}
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
        fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "you@company.com" }]}
      />
    </div>
  );
}
