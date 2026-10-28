"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Mail } from "lucide-react";
import { Callout } from "@/components/blocks/callout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resendConfirmation, type AuthFormState } from "./actions";

type Field = {
  name: string;
  label: string;
  type: "text" | "email" | "password";
  autoComplete: string;
  placeholder?: string;
  /** Password strength hint under the field (display only; the server enforces the rules). */
  meter?: boolean;
};

type Props = {
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  fields: Field[];
  submitLabel: string;
  /** Button text while the request runs, e.g. "Signing in…". */
  pendingLabel?: string;
  next?: string;
  variant?: "default" | "outline";
  /** Prefix for input ids when several forms share a page. */
  idPrefix?: string;
  /** Rendered between the fields and the button (e.g. "Forgot password?"). */
  beforeSubmit?: React.ReactNode;
  /** "check-email": replace the form with the confirm-your-email panel on success (sign-up). */
  success?: "inline" | "check-email";
};

export function AuthForm({
  action,
  fields,
  submitLabel,
  pendingLabel,
  next,
  variant = "default",
  idPrefix = "auth",
  beforeSubmit,
  success = "inline",
}: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const [submittedEmail, setSubmittedEmail] = useState("");

  if (success === "check-email" && state.message) {
    return <CheckEmail email={submittedEmail} next={next} />;
  }

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const email = e.currentTarget.elements.namedItem("email");
        if (email instanceof HTMLInputElement) setSubmittedEmail(email.value.trim());
      }}
      className="grid gap-4"
      noValidate
    >
      {next && <input type="hidden" name="next" value={next} />}

      {fields.map((field) => (
        <FieldRow key={field.name} field={field} idPrefix={idPrefix} errors={state.fieldErrors?.[field.name]} />
      ))}

      {beforeSubmit}

      {state.error && (
        <Callout
          tone="danger"
          action={
            state.errorLink && (
              <Button asChild size="sm" variant="outline">
                <Link href={state.errorLink.href}>{state.errorLink.label}</Link>
              </Button>
            )
          }
        >
          {state.error}
        </Callout>
      )}
      {state.message && <Callout tone="success">{state.message}</Callout>}

      <Button type="submit" size="lg" loading={pending} variant={variant} className="w-full">
        {pending && pendingLabel ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}

function FieldRow({ field, idPrefix, errors }: { field: Field; idPrefix: string; errors?: string[] }) {
  const inputId = `${idPrefix}-${field.name}`;
  const errorId = `${inputId}-error`;
  const [value, setValue] = useState("");
  const [shown, setShown] = useState(false);
  const isPassword = field.type === "password";

  const input = (
    <Input
      id={inputId}
      name={field.name}
      type={isPassword && shown ? "text" : field.type}
      autoComplete={field.autoComplete}
      placeholder={field.placeholder}
      inputMode={field.type === "email" ? "email" : undefined}
      required
      onChange={field.meter ? (e) => setValue(e.target.value) : undefined}
      aria-invalid={errors ? true : undefined}
      aria-describedby={errors ? errorId : undefined}
      className={isPassword ? "rounded-r-none" : undefined}
    />
  );

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={inputId}>{field.label}</Label>
      {isPassword ? (
        <div className="flex min-w-0">
          {input}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 rounded-l-none border-l-0 max-md:h-10"
            aria-label={shown ? "Hide password" : "Show password"}
            aria-pressed={shown}
            aria-controls={inputId}
            onClick={() => setShown((s) => !s)}
          >
            {shown ? <EyeOff /> : <Eye />}
          </Button>
        </div>
      ) : (
        input
      )}
      {field.meter && <StrengthMeter value={value} />}
      {errors && (
        <p id={errorId} className="text-xs text-destructive motion-safe:animate-[fade-up_200ms_var(--ease-out)]">
          {errors[0]}
        </p>
      )}
    </div>
  );
}

const STRENGTH = ["Use at least 8 characters", "Weak", "Fair", "Good", "Strong"];

function StrengthMeter({ value }: { value: string }) {
  const score = value.length < 8 ? 0 : [true, /[A-Z]/.test(value) && /[a-z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length;
  return (
    <>
      <div aria-hidden className="grid grid-cols-4 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-1 rounded-full transition-colors duration-[220ms] ${i < score ? "bg-teal" : "bg-muted"}`} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {STRENGTH[score]}
      </p>
    </>
  );
}

/** Shown after sign-up when Supabase is waiting for the email to be confirmed. */
function CheckEmail({ email, next }: { email: string; next?: string }) {
  const [state, formAction, pending] = useActionState(resendConfirmation, {});
  const id = useId();
  return (
    <div className="grid gap-5" role="status">
      <span className="grid size-16 place-items-center rounded-[20px] bg-teal-subtle text-teal shadow-card">
        <Mail aria-hidden className="size-6" />
      </span>
      <div className="grid gap-2">
        <h2 className="t-h2">Check your email</h2>
        <p className="text-muted-foreground">
          We sent a confirmation link to <b className="font-medium text-foreground">{email || "your email"}</b>. Open it on this device to finish
          setting up your account.
        </p>
      </div>
      <form action={formAction} className="grid gap-3">
        <input type="hidden" name="email" value={email} />
        {next && <input type="hidden" name="next" value={next} />}
        {state.error && <Callout tone="danger">{state.error}</Callout>}
        {state.message && <Callout tone="success">{state.message}</Callout>}
        <Button type="submit" variant="outline" loading={pending} aria-describedby={id}>
          Resend the link
        </Button>
        <p id={id} className="text-xs text-muted-foreground">
          Can&apos;t find it? Check spam or promotions. Wrong email?{" "}
          {/* Full page load on purpose: it resets the form state. */}
          <a href={next === "/upgrade?checkout=1" ? "/signup?plan=pro" : "/signup"} className="font-medium text-teal underline-offset-4 hover:underline">
            Start again
          </a>
          .
        </p>
      </form>
    </div>
  );
}
