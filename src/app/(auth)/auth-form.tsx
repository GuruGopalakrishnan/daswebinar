"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthFormState } from "./actions";

type Field = {
  name: string;
  label: string;
  type: "text" | "email" | "password";
  autoComplete: string;
  placeholder?: string;
};

type Props = {
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  fields: Field[];
  submitLabel: string;
  next?: string;
  variant?: "default" | "outline";
  /** Prefix for input ids when several forms share a page. */
  idPrefix?: string;
};

export function AuthForm({ action, fields, submitLabel, next, variant = "default", idPrefix = "auth" }: Props) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}

      {fields.map((field) => {
        const errors = state.fieldErrors?.[field.name];
        const inputId = `${idPrefix}-${field.name}`;
        const errorId = `${inputId}-error`;
        return (
          <div key={field.name} className="grid gap-1.5">
            <Label htmlFor={inputId}>{field.label}</Label>
            <Input
              id={inputId}
              name={field.name}
              type={field.type}
              autoComplete={field.autoComplete}
              placeholder={field.placeholder}
              required
              aria-invalid={errors ? true : undefined}
              aria-describedby={errors ? errorId : undefined}
            />
            {errors && (
              <p id={errorId} className="text-xs text-destructive">
                {errors[0]}
              </p>
            )}
          </div>
        );
      })}

      {state.error && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={pending} variant={variant} className="w-full">
        {pending && <Loader2 className="animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  );
}
