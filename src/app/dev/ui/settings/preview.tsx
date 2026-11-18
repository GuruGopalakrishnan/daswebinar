"use client";

import { ProfileSettings } from "@/components/settings/profile-settings";
import type { PlanId } from "@/lib/billing/plans";

export type State = "default" | "save-error" | "reset-limited" | "pro";

const wait = () => new Promise((r) => setTimeout(r, 700));

/** Labelled fakes: nothing is saved, no email is sent, nobody is signed out. */
export function SettingsPreview({ state }: { state: State }) {
  const plan: PlanId = state === "pro" ? "pro" : "free";
  return (
    <ProfileSettings
      userId="sample-host"
      fullName="Ananya Rao"
      email="ananya@example.com"
      plan={plan}
      updateProfile={async () => {
        await wait();
        return state === "save-error" ? { error: "Couldn't save your name. Try again. (sample error)" } : { ok: true };
      }}
      requestPasswordReset={async () => {
        await wait();
        return state === "reset-limited"
          ? { error: "Too many requests. Wait a minute, then try again. (sample error)" }
          : { message: "If an account uses that email, a reset link is on its way. It works for one hour. (sample: nothing was sent)" };
      }}
      signOut={async () => {}}
    />
  );
}
