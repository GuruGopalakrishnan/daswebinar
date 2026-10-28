"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CalendarPlus, CheckCircle2, Clock, Download, Hourglass, XCircle } from "lucide-react";
import { Callout } from "@/components/blocks/callout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CopyButton } from "@/components/copy-button";
import { REGISTERED_EVENT } from "@/components/register/mobile-register-bar";
import { downloadIcs, googleCalendarUrl } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/client";
import { useMounted } from "@/hooks/use-client-values";
import { cn } from "@/lib/utils";
import type { CustomField } from "@/lib/webinars/schema";
import type { RegistrationStatus, WebinarStatus } from "@/lib/webinars/types";

type Webinar = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  durationMinutes: number;
  status: WebinarStatus;
  isFull: boolean;
  requiresApproval: boolean;
  customFields: CustomField[];
};

type Props = {
  webinar: Webinar;
  /** A signed-in account (verified email). Guest sessions are null here. */
  user: { email: string; name: string } | null;
  /** Any session, including a guest one: enough to enter the room. */
  hasSession: boolean;
  existingStatus: RegistrationStatus | null;
  existingJoinPath: string | null;
  /** Where this page lives (/e/<slug> or /register/<id>): sign-in returns here. */
  pagePath?: string;
};

type Result = { status: RegistrationStatus; joinPath: string | null; hasSession: boolean };

const fade = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 }, transition: { duration: 0.22 } };

export function RegisterPanel({ webinar, user, hasSession, existingStatus, existingJoinPath, pagePath }: Props) {
  const [result, setResult] = useState<Result | null>(
    existingStatus && existingStatus !== "cancelled"
      ? { status: existingStatus, joinPath: existingJoinPath, hasSession }
      : null,
  );
  const path = pagePath ?? `/register/${webinar.id}`;
  const closed = webinar.status === "ended" || webinar.status === "cancelled";

  return (
    <div aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {result ? (
          <motion.div key="done" {...fade}>
            <Success webinar={webinar} {...result} />
          </motion.div>
        ) : closed ? (
          <motion.div key="closed" {...fade}>
            <StateBlock icon={Clock} tone="muted" title={webinar.status === "ended" ? "This webinar has ended" : "This webinar was cancelled"}>
              Registration is closed.
            </StateBlock>
          </motion.div>
        ) : webinar.isFull ? (
          <motion.div key="full" {...fade}>
            <StateBlock icon={Hourglass} tone="warn" title="This webinar is full">
              All seats have been taken, so registration is closed.
            </StateBlock>
          </motion.div>
        ) : (
          <motion.div key="form" {...fade}>
            <RegisterForm webinar={webinar} user={user} hasSession={hasSession} onDone={setResult} pagePath={path} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StateBlock({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "success" | "warn" | "danger" | "muted";
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-2 text-center">
      <span
        className={cn(
          "grid size-14 place-items-center rounded-full motion-safe:animate-[check-pop_520ms_var(--ease-out)_both]",
          tone === "success" && "bg-success-subtle text-success",
          tone === "warn" && "bg-warning-subtle text-warning-text",
          tone === "danger" && "bg-destructive-subtle text-destructive",
          tone === "muted" && "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-6" />
      </span>
      <h2 className="t-h3">{title}</h2>
      {children && <p className="text-sm text-pretty text-muted-foreground">{children}</p>}
    </div>
  );
}

/**
 * Guests get an anonymous session first, so they can enter the room without
 * creating an account. If anonymous sign-ins are off in Supabase, they still
 * register, just without room access.
 */
async function ensureGuestSession(fullName: string) {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  if (data.session) return true;
  const { error } = await supabase.auth.signInAnonymously({ options: { data: { full_name: fullName } } });
  return !error;
}

function RegisterForm({
  webinar,
  user,
  hasSession,
  onDone,
  pagePath,
}: {
  webinar: Webinar;
  user: Props["user"];
  hasSession: boolean;
  onDone: (result: Result) => void;
  pagePath: string;
}) {
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<Set<string>>(new Set());

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const fullName = String(form.get("fullName") ?? "").trim();
    const email = user?.email ?? String(form.get("email") ?? "").trim();

    const missingIds = new Set(
      webinar.customFields
        .filter((f) => f.required && (answers[f.id] === undefined || answers[f.id] === "" || answers[f.id] === false))
        .map((f) => f.id),
    );
    setMissing(missingIds);
    if (!fullName || !email || missingIds.size) {
      setError("Please fill in all required fields.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const session = hasSession || (await ensureGuestSession(fullName));
      const res = await fetch(`/api/webinars/${webinar.id}/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName, email, answers }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const emailError = json?.error?.details?.fieldErrors?.email;
        setError(emailError ? "Enter a valid email address." : (json?.error?.message ?? "Registration failed. Please try again."));
        return;
      }
      onDone({ status: json.data.status, joinPath: json.data.joinPath ?? null, hasSession: session });
      window.dispatchEvent(new Event(REGISTERED_EVENT));
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <div className="grid gap-1">
        <h2 className="t-h3">Save your seat</h2>
        <p className="text-sm text-muted-foreground">
          {webinar.requiresApproval ? "Free. The host reviews every registration." : "Free. Takes less than a minute."}
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="reg-name">Full name</Label>
        <Input id="reg-name" name="fullName" autoComplete="name" required defaultValue={user?.name ?? ""} maxLength={100} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="reg-email">Email address</Label>
        <Input
          id="reg-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          defaultValue={user?.email ?? ""}
          readOnly={user !== null}
          aria-describedby={user ? "reg-email-note" : undefined}
          className={user ? "text-muted-foreground" : undefined}
        />
        {user && (
          <p id="reg-email-note" className="text-xs text-muted-foreground">
            Registering with your account email.
          </p>
        )}
      </div>

      {webinar.customFields.map((f) => {
        const id = `reg-${f.id}`;
        const invalid = missing.has(f.id) || undefined;
        const label = (
          <>
            {f.label} {f.required && <span className="text-destructive" aria-hidden>*</span>}
            {f.required && <span className="sr-only">(required)</span>}
          </>
        );
        if (f.type === "checkbox") {
          return (
            <label key={f.id} htmlFor={id} className="flex items-start gap-2.5 text-sm">
              <Checkbox
                id={id}
                checked={answers[f.id] === true}
                onCheckedChange={(v) => setAnswers((a) => ({ ...a, [f.id]: v === true }))}
                aria-invalid={invalid}
                className="mt-0.5"
              />
              <span>{label}</span>
            </label>
          );
        }
        return (
          <div key={f.id} className="grid gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            {f.type === "select" ? (
              <Select value={(answers[f.id] as string) ?? ""} onValueChange={(v) => setAnswers((a) => ({ ...a, [f.id]: v }))}>
                <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {f.options.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : f.type === "textarea" ? (
              <Textarea
                id={id}
                rows={3}
                maxLength={1000}
                value={(answers[f.id] as string) ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [f.id]: e.target.value }))}
                aria-invalid={invalid}
              />
            ) : (
              <Input
                id={id}
                maxLength={1000}
                value={(answers[f.id] as string) ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [f.id]: e.target.value }))}
                aria-invalid={invalid}
              />
            )}
          </div>
        );
      })}

      {error && <Callout tone="danger">{error}</Callout>}

      <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
        {pending ? "Registering…" : "Register now · Free"}
        {!pending && <ArrowRight />}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {webinar.requiresApproval
          ? "You'll get your join link by email once the host approves you."
          : "You'll get a confirmation email with your personal join link."}
      </p>

      {!user && (
        <p className="text-center text-xs text-muted-foreground">
          Have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(pagePath)}`} className="font-medium text-teal underline-offset-4 hover:underline">
            Sign in to register
          </Link>
        </p>
      )}
    </form>
  );
}

function Success({ webinar, status, joinPath, hasSession }: { webinar: Webinar } & Result) {
  // This can be server-rendered for returning registrants; read the origin only after mount.
  const mounted = useMounted();
  const event = {
    id: webinar.id,
    title: webinar.title,
    description: webinar.description ?? "",
    startsAt: webinar.startsAt,
    durationMinutes: webinar.durationMinutes,
    url: mounted ? `${window.location.origin}/register/${webinar.id}` : `/register/${webinar.id}`,
  };

  if (status === "rejected") {
    return (
      <StateBlock icon={XCircle} tone="danger" title="Registration not approved">
        The host wasn&apos;t able to approve your registration for this webinar.
      </StateBlock>
    );
  }

  const approved = status === "approved";
  const open = webinar.status === "scheduled" || webinar.status === "live";
  const canJoin = approved && hasSession && open;
  const live = webinar.status === "live";

  return (
    <div className="grid gap-4">
      <StateBlock icon={approved ? CheckCircle2 : Hourglass} tone={approved ? "success" : "warn"} title={approved ? "You're registered!" : "Registration received"}>
        {approved
          ? live
            ? "The webinar is live. Join now."
            : "Add it to your calendar so you don't miss it. Your join link is also in your inbox."
          : "The host approves each registration. We'll email your join link once you're approved."}
      </StateBlock>

      {canJoin && (
        <Button asChild size="lg" className={cn("w-full", live && "bg-live text-white hover:bg-live/90")}>
          <Link href={`/room/${webinar.id}`}>
            {live ? "Join live now" : "Join webinar"} <ArrowRight />
          </Link>
        </Button>
      )}
      {canJoin && !live && (
        <p className="-mt-2 text-center text-xs text-muted-foreground">
          Join opens the waiting room. It becomes the live room when the host starts.
        </p>
      )}

      {approved && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => downloadIcs(event)}>
            <Download /> Apple / Outlook
          </Button>
          <Button asChild variant="outline">
            <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
              <CalendarPlus /> Google
            </a>
          </Button>
        </div>
      )}

      {approved && open && joinPath && (
        <div className="rounded-lg border bg-surface-2 p-3 text-left">
          <p className="text-xs font-semibold">Your personal join link</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Save it to join from any device. It&apos;s yours alone, so don&apos;t share it.</p>
          <CopyButton value={joinPath} size="sm" className="mt-2 w-full" label="Copy join link" />
        </div>
      )}

      {hasSession && (
        <p className="text-center text-xs text-muted-foreground">
          See all your registrations in{" "}
          <Link href="/my-events" className="font-medium text-teal underline-offset-4 hover:underline">
            My events
          </Link>
          .
        </p>
      )}
      {approved && !hasSession && (
        // No session means guest sign-ins are off in Supabase, so attendees need an account to enter the room.
        <p className="text-center text-xs text-muted-foreground">
          To chat and ask questions live,{" "}
          <Link href="/signup" className="font-medium text-teal underline-offset-4 hover:underline">
            create a free account
          </Link>{" "}
          with the same email, then sign in and register again.
        </p>
      )}
    </div>
  );
}
