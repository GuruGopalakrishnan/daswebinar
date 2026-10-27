import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { requestPasswordReset } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  return (
    <div className="grid gap-8">
      <div className="grid gap-1.5">
        <h1 className="font-display text-3xl tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground">Enter your account email and we&apos;ll send you a link to choose a new one.</p>
      </div>

      <Suspense fallback={null}>
        <LinkError searchParams={searchParams} />
      </Suspense>

      <AuthForm
        action={requestPasswordReset}
        submitLabel="Send reset link"
        fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "you@company.com" }]}
      />

      <Link href="/login" className="inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to log in
      </Link>
    </div>
  );
}

async function LinkError({ searchParams }: Pick<PageProps<"/forgot-password">, "searchParams">) {
  const params = await searchParams;
  if (params.error !== "link") return null;
  return (
    <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      That reset link has expired or was opened in a different browser. Request a new one here and open it on this device.
    </p>
  );
}
