"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { RESET_PASSWORD_PATH, safeNextPath } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";

export type AuthFormState = {
  error?: string;
  /** Optional next step shown with the error. */
  errorLink?: { href: string; label: string };
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

const credentialsSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const signUpSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(1, "Enter your name.").max(100),
});

const magicLinkSchema = z.object({
  email: z.email("Enter a valid email address."),
});

/** Email links point at this deployment's public URL (never localhost in production). */
async function callbackUrl(next: string) {
  return `${await getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        error: "Confirm your email first. We sent you a link when you signed up.",
        errorLink: { href: "/verify-email", label: "Send the link again" },
      };
    }
    // Generic message: don't reveal whether the email exists.
    return { error: "Invalid email or password." };
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const next = safeNextPath(formData.get("next"), "/onboarding");
  const { email, password, fullName } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: await callbackUrl(next),
    },
  });
  if (error) {
    return { error: error.message };
  }

  // With email confirmation on (the Supabase default) there is no session yet.
  if (!data.session) {
    return { message: `Almost there! We sent a confirmation link to ${email}. Open it to finish setting up your account.` };
  }
  redirect(next);
}

export async function sendMagicLink(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = magicLinkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: await callbackUrl(safeNextPath(formData.get("next"))),
    },
  });
  if (error && error.status !== 422) {
    return { error: "Could not send the link. Try again shortly." };
  }

  return { message: "If that account exists, a sign-in link is on its way." };
}

/** Re-sends the sign-up confirmation link. Same answer whether or not the account exists. */
export async function resendConfirmation(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = magicLinkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: await callbackUrl(safeNextPath(formData.get("next"), "/onboarding")) },
  });
  if (error?.status === 429) {
    return { error: "Too many requests. Wait a minute, then try again." };
  }
  return { message: `If ${parsed.data.email} is waiting for confirmation, a new link is on its way.` };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = magicLinkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: await callbackUrl(RESET_PASSWORD_PATH),
  });
  if (error?.status === 429) {
    return { error: "Too many requests. Wait a minute, then try again." };
  }
  // Same answer whether or not the account exists.
  return { message: "If an account uses that email, a reset link is on its way. It works for one hour." };
}

const newPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { message: "The passwords don't match.", path: ["confirmPassword"] });

export async function updatePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user || data.user.is_anonymous) {
    return { error: "This reset link has expired. Request a new one." };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "Choose a password you haven't used before."
          : error.code === "weak_password"
            ? "That password is too easy to guess. Try a longer one."
            : "Couldn't update your password. Request a new reset link and try again.",
    };
  }
  redirect("/dashboard");
}
