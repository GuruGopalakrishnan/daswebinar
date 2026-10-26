"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth";
import { env } from "@/lib/env";

export type AuthFormState = {
  error?: string;
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

function callbackUrl(next: string) {
  return `${env.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
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

  const { email, password, fullName } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: callbackUrl("/dashboard"),
    },
  });
  if (error) {
    return { error: error.message };
  }

  // With email confirmation on (the Supabase default) there is no session yet.
  if (!data.session) {
    return { message: "Check your email to confirm your account." };
  }
  redirect("/dashboard");
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
      emailRedirectTo: callbackUrl(safeNextPath(formData.get("next"))),
    },
  });
  if (error && error.status !== 422) {
    return { error: "Could not send the link. Try again shortly." };
  }

  return { message: "If that account exists, a sign-in link is on its way." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
