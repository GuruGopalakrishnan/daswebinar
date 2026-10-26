import Link from "next/link";
import type { Metadata } from "next";
import { signUp } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <div className="grid gap-8">
      <div className="grid gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">Host your first webinar in minutes. Free forever plan.</p>
      </div>

      <AuthForm
        action={signUp}
        submitLabel="Create account"
        fields={[
          { name: "fullName", label: "Name", type: "text", autoComplete: "name", placeholder: "Ada Lovelace" },
          { name: "email", label: "Work email", type: "email", autoComplete: "email", placeholder: "you@company.com" },
          { name: "password", label: "Password", type: "password", autoComplete: "new-password", placeholder: "At least 8 characters" },
        ]}
      />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
