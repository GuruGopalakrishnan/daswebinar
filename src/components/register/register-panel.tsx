"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CalendarPlus, CheckCircle2, Clock, Download, Hourglass, Loader2 } from "lucide-react";
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
};

type Result = { status: RegistrationStatus; joinPath: string | null; hasSession: boolean };

export function RegisterPanel({ webinar, user, hasSession, existingStatus, existingJoinPath }: Props) {
  const [result, setResult] = useState<Result | null>(
    existingStatus && existingStatus !== "cancelled"
      ? { status: existingStatus, joinPath: existingJoinPath, hasSession }
      : null,
  );

  const closed = webinar.status === "ended" || webinar.status === "cancelled";

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-xl shadow-black/5 sm:p-7">
      <AnimatePresence mode="wait" initial={false}>
        {result ? (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
            <Success webinar={webinar} {...result} />
          </motion.div>
        ) : closed ? (
          <motion.div key="closed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <Clock className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">{webinar.status === "ended" ? "This webinar has ended" : "This webinar was cancelled"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Registration is closed.</p>
          </motion.div>
        ) : webinar.isFull ? (
          <motion.div key="full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <Hourglass className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">This webinar is full</h2>
            <p className="mt-1 text-sm text-muted-foreground">All seats have been taken. Check back — spots sometimes open up.</p>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
            <RegisterForm webinar={webinar} user={user} hasSession={hasSession} onDone={setResult} />
          </motion.div>
        )}
      </AnimatePresence>
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
}: {
  webinar: Webinar;
  user: Props["user"];
  hasSession: boolean;
  onDone: (result: Result) => void;
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
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Save your seat</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {webinar.requiresApproval ? "The host reviews every registration." : "Free · Takes 10 seconds."}
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="reg-name">Full name</Label>
        <Input id="reg-name" name="fullName" autoComplete="name" required defaultValue={user?.name ?? ""} maxLength={100} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="reg-email">Email</Label>
        <Input
          id="reg-email"
          name="email"
          type="email"
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
            {f.label} {f.required && <span className="text-destructive">*</span>}
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

      {error && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
        {pending ? <Loader2 className="animate-spin" /> : null}
        Register
        {!pending && <ArrowRight />}
      </Button>

      {!user && (
        <p className="text-center text-xs text-muted-foreground">
          Have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(`/register/${webinar.id}`)}`} className="text-foreground underline-offset-4 hover:underline">
            Log in to register
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
      <div className="text-center">
        <h2 className="font-semibold">Registration not approved</h2>
        <p className="mt-1 text-sm text-muted-foreground">The host wasn&apos;t able to approve your registration for this webinar.</p>
      </div>
    );
  }

  const approved = status === "approved";
  const open = webinar.status === "scheduled" || webinar.status === "live";
  const canJoin = approved && hasSession && open;

  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.5 }}
        className={`mx-auto flex size-14 items-center justify-center rounded-full ${approved ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
      >
        {approved ? <CheckCircle2 className="size-7" /> : <Hourglass className="size-7" />}
      </motion.div>
      <h2 className="mt-4 text-lg font-semibold">{approved ? "You're registered!" : "Request received"}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {approved
          ? "Add it to your calendar so you don't miss it."
          : "The host will review your registration. Check back on this page for updates."}
      </p>

      <div className="mt-6 grid gap-2">
        {canJoin && (
          <Button asChild size="lg" className={webinar.status === "live" ? "bg-live text-white hover:bg-live/90" : undefined}>
            <Link href={`/room/${webinar.id}`}>
              {webinar.status === "live" ? "Join live now" : "Go to the room"} <ArrowRight />
            </Link>
          </Button>
        )}
        {approved && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => downloadIcs(event)}>
              <Download /> .ics file
            </Button>
            <Button asChild variant="outline">
              <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
                <CalendarPlus /> Google
              </a>
            </Button>
          </div>
        )}
        {approved && open && joinPath && (
          <div className="mt-2 rounded-lg border bg-muted/40 p-3 text-left">
            <p className="text-xs font-medium">Your personal join link</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Save it to join from any device. It&apos;s yours alone, so don&apos;t share it.
            </p>
            <CopyButton value={joinPath} size="sm" className="mt-2 w-full" label="Copy join link" />
          </div>
        )}
        {approved && !hasSession && (
          <p className="mt-2 text-xs text-muted-foreground">
            To chat and ask questions live,{" "}
            <Link href={`/signup`} className="text-foreground underline-offset-4 hover:underline">
              create a free account
            </Link>{" "}
            with the same email, then log in and register again.
          </p>
        )}
      </div>
    </div>
  );
}
