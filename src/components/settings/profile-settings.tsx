"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut, Mail } from "lucide-react";
import { toast } from "sonner";
import { Callout } from "@/components/blocks/callout";
import { SectionCard, SettingRow } from "@/components/blocks/surfaces";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import type { AuthFormState } from "@/app/(auth)/actions";
import type { ProfileFormState } from "@/app/dashboard/settings/actions";
import { BRAND } from "@/lib/brand";
import { PLANS, type PlanId } from "@/lib/billing/plans";

type FormAction<S> = (prev: S, formData: FormData) => Promise<S>;

export type ProfileSettingsProps = {
  userId: string;
  fullName: string;
  email: string;
  plan: PlanId;
  /** Server actions. The page passes the real ones; the dev preview passes labelled fakes. */
  updateProfile: FormAction<ProfileFormState>;
  requestPasswordReset: FormAction<AuthFormState>;
  signOut: () => Promise<void>;
};

/** Account settings: display name, sign-in email (read-only), password reset by email, sign out, plan link. */
export function ProfileSettings({ userId, fullName, email, plan, updateProfile, requestPasswordReset, signOut }: ProfileSettingsProps) {
  return (
    <div className="grid gap-6">
      <PageHeader title="Account settings" description="Your name, how you sign in, and your plan." />
      <ProfileCard userId={userId} fullName={fullName} email={email} action={updateProfile} />
      <SecurityCard email={email} action={requestPasswordReset} signOut={signOut} />
      <SectionCard title="Plan">
        <SettingRow
          title={`${PLANS[plan].name} plan`}
          description="Upgrade, see your usage or cancel on the billing page."
          control={
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/billing">Plan &amp; billing</Link>
            </Button>
          }
        />
      </SectionCard>
    </div>
  );
}

function ProfileCard({ userId, fullName, email, action }: { userId: string; fullName: string; email: string; action: FormAction<ProfileFormState> }) {
  const router = useRouter();
  const [name, setName] = useState(fullName);
  const [saved, setSaved] = useState(fullName);
  const submitted = useRef(fullName);
  const [state, formAction, pending] = useActionState(action, {});

  useEffect(() => {
    if (!state.ok) return;
    setSaved(submitted.current);
    toast.success("Name saved", { description: "It shows on your event pages, emails and in the room." });
    router.refresh();
    // Only when a save finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const dirty = name.trim() !== saved.trim();
  const fieldError = state.fieldErrors?.fullName?.[0];

  return (
    <SectionCard title="Profile">
      <form
        action={(fd) => {
          submitted.current = String(fd.get("fullName") ?? "").trim();
          formAction(fd);
        }}
        className="grid gap-6"
      >
        <div className="flex items-center gap-4">
          <UserAvatar name={name.trim() || email} id={userId} className="size-14 text-lg" />
          <div className="min-w-0">
            <p className="t-title truncate">{name.trim() || "Your name"}</p>
            <p className="truncate text-[13px] text-muted-foreground">{email}</p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="grid content-start gap-1.5">
            <label htmlFor="fullName" className="text-sm font-medium">
              Full name
            </label>
            <Input
              id="fullName"
              name="fullName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              autoComplete="name"
              aria-invalid={fieldError ? true : undefined}
              aria-describedby="fullName-help"
            />
            <p id="fullName-help" className={fieldError ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
              {fieldError ?? "Attendees see this as the host on your event pages and emails."}
            </p>
          </div>
          <div className="grid content-start gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Sign-in email
            </label>
            <Input id="email" value={email} readOnly disabled aria-describedby="email-help" />
            <p id="email-help" className="text-xs text-muted-foreground">
              Changing your sign-in email isn&apos;t available yet.
            </p>
          </div>
        </div>

        {state.error && <Callout tone="danger">{state.error}</Callout>}

        <div className="flex flex-wrap items-center gap-3 border-t pt-5">
          <Button type="submit" disabled={!dirty} loading={pending}>
            Save changes
          </Button>
          {dirty && !pending && (
            <Button type="button" variant="ghost" onClick={() => setName(saved)}>
              Discard
            </Button>
          )}
        </div>
      </form>
    </SectionCard>
  );
}

function SecurityCard({ email, action, signOut }: { email: string; action: FormAction<AuthFormState>; signOut: () => Promise<void> }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <SectionCard title="Sign-in & security" bodyClassName="py-1 md:py-2">
      <SettingRow
        title={
          <span className="flex items-center gap-2">
            <KeyRound aria-hidden className="size-4 text-muted-foreground" /> Password
          </span>
        }
        description={
          state.message ? (
            <span role="status" className="text-success">
              {state.message}
            </span>
          ) : state.error ? (
            <span role="alert" className="text-destructive">
              {state.error}
            </span>
          ) : (
            "We'll email you a secure link to set a new password."
          )
        }
        control={
          <form action={formAction}>
            <input type="hidden" name="email" value={email} />
            <Button type="submit" variant="outline" size="sm" loading={pending}>
              {!pending && <Mail />} Email me a reset link
            </Button>
          </form>
        }
      />
      <SettingRow
        title={
          <span className="flex items-center gap-2">
            <LogOut aria-hidden className="size-4 text-muted-foreground" /> Sign out
          </span>
        }
        description={`Sign out of ${BRAND.name} in this browser.`}
        control={
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        }
      />
    </SectionCard>
  );
}
