"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  GripVertical,
  ListChecks,
  Loader2,
  Lock,
  Plus,
  SquareCheck,
  Text,
  TextCursorInput,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useMounted } from "@/hooks/use-client-values";
import { cn } from "@/lib/utils";
import { allTimeZones, browserTimeZone, utcToZoned, zoneOffsetLabel, zonedToUtcIso } from "@/lib/time";
import { formatDate, formatDuration, formatTime } from "@/lib/format";
import type { CustomField } from "@/lib/webinars/schema";
import type { WebinarDto } from "@/lib/webinars/dto";

type FieldType = CustomField["type"];

type FormState = {
  title: string;
  description: string;
  date: string;
  time: string;
  timezone: string;
  durationMinutes: number;
  visibility: "public" | "unlisted";
  requiresApproval: boolean;
  capacityEnabled: boolean;
  capacity: string;
  customFields: CustomField[];
};

const STEPS = [
  { id: "details", label: "Details" },
  { id: "schedule", label: "Schedule" },
  { id: "settings", label: "Settings" },
  { id: "form", label: "Registration form" },
  { id: "review", label: "Review" },
] as const;

const DURATIONS = [30, 45, 60, 90, 120];

const FIELD_TYPES: { type: FieldType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "text", label: "Short text", icon: TextCursorInput },
  { type: "textarea", label: "Long text", icon: Text },
  { type: "select", label: "Dropdown", icon: ListChecks },
  { type: "checkbox", label: "Checkbox", icon: SquareCheck },
];

function newFieldId() {
  return `f_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

function defaultState(): FormState {
  const tz = browserTimeZone();
  // Default: next full hour, tomorrow.
  const start = new Date(Date.now() + 24 * 3600_000);
  start.setMinutes(0, 0, 0);
  const { date, time } = utcToZoned(start.toISOString(), tz);
  return {
    title: "",
    description: "",
    date,
    time,
    timezone: tz,
    durationMinutes: 60,
    visibility: "unlisted",
    requiresApproval: false,
    capacityEnabled: false,
    capacity: "100",
    customFields: [],
  };
}

function fromWebinar(w: WebinarDto): FormState {
  const { date, time } = utcToZoned(w.startsAt, w.timezone);
  return {
    title: w.title,
    description: w.description ?? "",
    date,
    time,
    timezone: w.timezone,
    durationMinutes: w.durationMinutes,
    visibility: w.visibility,
    requiresApproval: w.requiresApproval,
    capacityEnabled: w.capacity !== null,
    capacity: String(w.capacity ?? 100),
    customFields: w.customFields,
  };
}

type Errors = Partial<Record<string, string>>;

/** `originalStartsAt`: when editing, an unchanged start time may be in the past. */
function validateStep(step: number, s: FormState, originalStartsAt?: string): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (!s.title.trim()) e.title = "Give your webinar a title.";
    else if (s.title.length > 200) e.title = "Keep the title under 200 characters.";
    if (s.description.length > 5000) e.description = "Keep the description under 5,000 characters.";
  }
  if (step === 1) {
    if (!s.date) e.date = "Pick a date.";
    if (!s.time) e.time = "Pick a time.";
    if (s.date && s.time) {
      const startsAt = zonedToUtcIso(s.date, s.time, s.timezone);
      const unchanged = originalStartsAt !== undefined && new Date(startsAt).getTime() === new Date(originalStartsAt).getTime();
      if (!unchanged && new Date(startsAt).getTime() < Date.now()) e.time = "This time is in the past.";
    }
    if (s.durationMinutes < 5 || s.durationMinutes > 720) e.duration = "Between 5 minutes and 12 hours.";
  }
  if (step === 2 && s.capacityEnabled) {
    const n = Number(s.capacity);
    if (!Number.isInteger(n) || n < 1 || n > 100_000) e.capacity = "Enter a whole number from 1 to 100,000.";
  }
  if (step === 3) {
    s.customFields.forEach((f, i) => {
      if (!f.label.trim()) e[`field-${i}`] = "Add a question label.";
      if (f.type === "select") {
        const opts = f.options.map((o) => o.trim()).filter(Boolean);
        if (opts.length < 2) e[`field-${i}`] = "Dropdowns need at least two options.";
        else if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) e[`field-${i}`] = "Options must be unique.";
      }
    });
  }
  return e;
}

export function WebinarForm({ webinar }: { webinar?: WebinarDto }) {
  // New-webinar defaults depend on the clock and the browser's time zone, so
  // render them only after mount to keep server and client output identical.
  const mounted = useMounted();
  if (!mounted) {
    return (
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]" aria-busy>
        <Skeleton className="h-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  return <WebinarFormSteps webinar={webinar} />;
}

function WebinarFormSteps({ webinar }: { webinar?: WebinarDto }) {
  const router = useRouter();
  const editing = Boolean(webinar);
  const [state, setState] = useState<FormState>(() => (webinar ? fromWebinar(webinar) : defaultState()));
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState<null | "draft" | "scheduled">(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  function goTo(target: number) {
    if (target > step) {
      for (let i = step; i < target; i++) {
        const e = validateStep(i, state, webinar?.startsAt);
        if (Object.keys(e).length) {
          setErrors(e);
          setDirection(1);
          setStep(i);
          return;
        }
      }
    }
    setErrors({});
    setDirection(target > step ? 1 : -1);
    setStep(target);
  }

  async function submit(status: "draft" | "scheduled") {
    for (let i = 0; i < STEPS.length - 1; i++) {
      const e = validateStep(i, state, webinar?.startsAt);
      if (Object.keys(e).length) {
        setErrors(e);
        setDirection(-1);
        setStep(i);
        return;
      }
    }

    const body = {
      title: state.title.trim(),
      description: state.description.trim() || null,
      startsAt: zonedToUtcIso(state.date, state.time, state.timezone),
      durationMinutes: state.durationMinutes,
      timezone: state.timezone,
      visibility: state.visibility,
      requiresApproval: state.requiresApproval,
      capacity: state.capacityEnabled ? Number(state.capacity) : null,
      customFields: state.customFields.map((f) => ({
        ...f,
        label: f.label.trim(),
        options: f.type === "select" ? f.options.map((o) => o.trim()).filter(Boolean) : [],
      })),
      // Editing a live/ended webinar must not touch its status.
      ...(editing && webinar && !["draft", "scheduled"].includes(webinar.status) ? {} : { status }),
    };

    setSubmitting(status);
    try {
      const res = await fetch(editing ? `/api/webinars/${webinar!.id}` : "/api/webinars", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        if (json?.error?.code === "plan_webinar_limit") {
          toast.error(json.error.message, {
            action: { label: "Upgrade", onClick: () => router.push("/dashboard/billing") },
          });
          return;
        }
        toast.error(json?.error?.message ?? "Something went wrong. Please try again.");
        return;
      }
      toast.success(
        editing ? "Changes saved" : status === "draft" ? "Draft saved" : "Webinar scheduled — share your registration link!",
      );
      router.push(`/dashboard/webinars/${json.data.id}`);
      router.refresh();
    } catch {
      toast.error("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(null);
    }
  }

  const isLast = step === STEPS.length - 1;

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      {/* Step rail */}
      <nav aria-label="Steps" className="lg:sticky lg:top-20 lg:self-start">
        <ol className="flex gap-1 overflow-x-auto lg:flex-col scrollbar-thin">
          {STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={s.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    current ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs transition-colors",
                      done && "border-primary bg-primary text-primary-foreground",
                      current && "border-primary text-primary",
                    )}
                  >
                    {done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span className="whitespace-nowrap">{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 hidden h-1 overflow-hidden rounded-full bg-muted lg:block">
          <motion.div className="h-full bg-primary" animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </nav>

      {/* Step body */}
      <div className="min-w-0">
        <div className="relative overflow-hidden rounded-xl border bg-card">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="p-6 sm:p-8"
            >
              {step === 0 && <DetailsStep state={state} set={set} errors={errors} />}
              {step === 1 && <ScheduleStep state={state} set={set} errors={errors} />}
              {step === 2 && <SettingsStep state={state} set={set} errors={errors} />}
              {step === 3 && <FormStep state={state} set={set} errors={errors} />}
              {step === 4 && <ReviewStep state={state} onEdit={goTo} />}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between gap-2 border-t bg-muted/30 px-6 py-4 sm:px-8">
            <Button type="button" variant="ghost" onClick={() => goTo(step - 1)} disabled={step === 0 || submitting !== null}>
              <ArrowLeft /> Back
            </Button>
            <div className="flex gap-2">
              {isLast ? (
                <>
                  {(!editing || webinar?.status === "draft") && (
                    <Button type="button" variant="outline" onClick={() => submit("draft")} disabled={submitting !== null}>
                      {submitting === "draft" && <Loader2 className="animate-spin" />}
                      Save as draft
                    </Button>
                  )}
                  <Button type="button" onClick={() => submit("scheduled")} disabled={submitting !== null}>
                    {submitting === "scheduled" && <Loader2 className="animate-spin" />}
                    {editing && webinar?.status !== "draft" ? "Save changes" : "Schedule webinar"}
                  </Button>
                </>
              ) : (
                <Button type="button" onClick={() => goTo(step + 1)}>
                  Continue <ArrowRight />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

type StepProps = {
  state: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  errors: Errors;
};

function StepHeader({ title, body }: { title: string; body: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-destructive">
      {message}
    </p>
  );
}

function DetailsStep({ state, set, errors }: StepProps) {
  return (
    <>
      <StepHeader title="What's it about?" body="This is what people see on your registration page." />
      <div className="grid gap-5">
        <div className="grid gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            autoFocus
            value={state.title}
            maxLength={200}
            placeholder="e.g. Product launch: what's new in v2"
            onChange={(e) => set("title", e.target.value)}
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? "title-error" : undefined}
            className="h-11 text-base"
          />
          <FieldError id="title-error" message={errors.title} />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="description">Description</Label>
            <span className="text-xs text-muted-foreground tabular-nums">{state.description.length}/5000</span>
          </div>
          <Textarea
            id="description"
            rows={7}
            value={state.description}
            maxLength={5000}
            placeholder="What will attendees learn? Who is it for? Who's speaking?"
            onChange={(e) => set("description", e.target.value)}
            aria-invalid={errors.description ? true : undefined}
          />
          <FieldError id="description-error" message={errors.description} />
        </div>
      </div>
    </>
  );
}

function ScheduleStep({ state, set, errors }: StepProps) {
  const zones = useMemo(() => allTimeZones(), []);
  const custom = !DURATIONS.includes(state.durationMinutes);
  const preview =
    state.date && state.time ? zonedToUtcIso(state.date, state.time, state.timezone) : null;

  return (
    <>
      <StepHeader title="When is it?" body="Attendees see the time converted to their own time zone." />
      <div className="grid gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={state.date}
              onChange={(e) => set("date", e.target.value)}
              aria-invalid={errors.date ? true : undefined}
            />
            <FieldError id="date-error" message={errors.date} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="time">Start time</Label>
            <Input
              id="time"
              type="time"
              step={300}
              value={state.time}
              onChange={(e) => set("time", e.target.value)}
              aria-invalid={errors.time ? true : undefined}
              aria-describedby={errors.time ? "time-error" : undefined}
            />
            <FieldError id="time-error" message={errors.time} />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="timezone">Time zone</Label>
          <Select value={state.timezone} onValueChange={(v) => set("timezone", v)}>
            <SelectTrigger id="timezone" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {zones.map((z) => (
                <SelectItem key={z} value={z}>
                  {z.replaceAll("_", " ")} <span className="text-muted-foreground">({zoneOffsetLabel(z)})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Duration</Label>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => set("durationMinutes", d)}
                aria-pressed={state.durationMinutes === d}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  state.durationMinutes === d
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                )}
              >
                {formatDuration(d)}
              </button>
            ))}
            <div className={cn("flex items-center gap-1.5 rounded-lg border px-2", custom && "border-primary")}>
              <Input
                type="number"
                min={5}
                max={720}
                aria-label="Custom duration in minutes"
                value={custom ? state.durationMinutes : ""}
                placeholder="Custom"
                onChange={(e) => set("durationMinutes", Number(e.target.value) || 0)}
                className="h-7 w-20 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
              <span className="text-xs text-muted-foreground">min</span>
            </div>
          </div>
          <FieldError id="duration-error" message={errors.duration} />
        </div>

        {preview && !errors.time && (
          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            <p className="font-medium">{formatDate(preview, state.timezone)}</p>
            <p className="text-muted-foreground">
              {formatTime(preview, state.timezone)} · {formatDuration(state.durationMinutes)}
              {state.timezone !== browserTimeZone() && <> · {formatTime(preview)} your time</>}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function SettingsStep({ state, set, errors }: StepProps) {
  return (
    <>
      <StepHeader title="Who can join?" body="Control discovery, approvals and capacity." />
      <div className="grid gap-6">
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Visibility</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                { value: "unlisted", icon: EyeOff, title: "Unlisted", body: "Only people with the link can register." },
                { value: "public", icon: Eye, title: "Public", body: "Listed publicly and shareable anywhere." },
              ] as const
            ).map((o) => (
              <label
                key={o.value}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
                  state.visibility === o.value ? "border-primary bg-primary/5" : "hover:border-foreground/20",
                )}
              >
                <input
                  type="radio"
                  name="visibility"
                  value={o.value}
                  checked={state.visibility === o.value}
                  onChange={() => set("visibility", o.value)}
                  className="sr-only"
                />
                <o.icon className={cn("mt-0.5 size-4", state.visibility === o.value ? "text-primary" : "text-muted-foreground")} />
                <span>
                  <span className="block text-sm font-medium">{o.title}</span>
                  <span className="block text-xs text-muted-foreground">{o.body}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <SettingRow
          id="approval"
          title="Require approval"
          body="Review each registration before attendees can join."
          checked={state.requiresApproval}
          onChange={(v) => set("requiresApproval", v)}
        />

        <div className="grid gap-3">
          <SettingRow
            id="capacity-toggle"
            title="Limit capacity"
            body="Close registration once you hit a number of seats."
            checked={state.capacityEnabled}
            onChange={(v) => set("capacityEnabled", v)}
          />
          <AnimatePresence initial={false}>
            {state.capacityEnabled && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid gap-1.5 pl-1">
                  <Label htmlFor="capacity">Maximum attendees</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min={1}
                    max={100000}
                    value={state.capacity}
                    onChange={(e) => set("capacity", e.target.value)}
                    className="max-w-40"
                    aria-invalid={errors.capacity ? true : undefined}
                  />
                  <FieldError id="capacity-error" message={errors.capacity} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

function SettingRow({
  id,
  title,
  body,
  checked,
  onChange,
}: {
  id: string;
  title: string;
  body: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">
          {title}
        </Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function FormStep({ state, set, errors }: StepProps) {
  const fields = state.customFields;
  const update = (i: number, patch: Partial<CustomField>) =>
    set("customFields", fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i: number, by: number) => {
    const next = [...fields];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item!);
    set("customFields", next);
  };
  const add = (type: FieldType) =>
    set("customFields", [
      ...fields,
      { id: newFieldId(), label: "", type, required: false, options: type === "select" ? ["", ""] : [] },
    ]);

  return (
    <>
      <StepHeader title="Registration questions" body="Name and email are always collected. Add up to 10 more questions." />
      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <div className="grid gap-3">
          {(["Full name", "Email"] as const).map((label) => (
            <div key={label} className="flex items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
              <Lock className="size-3.5" /> {label}
              <span className="ml-auto text-xs">Required</span>
            </div>
          ))}

          <AnimatePresence initial={false}>
            {fields.map((field, i) => {
              const meta = FIELD_TYPES.find((t) => t.type === field.type)!;
              const error = errors[`field-${i}`];
              return (
                <motion.div
                  key={field.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className={cn("rounded-xl border bg-background p-4", error && "border-destructive/50")}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="mt-2.5 size-4 shrink-0 text-muted-foreground/50" aria-hidden />
                    <div className="grid min-w-0 flex-1 gap-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                          <meta.icon className="size-3.5" /> {meta.label}
                        </span>
                        <Input
                          value={field.label}
                          maxLength={120}
                          placeholder="Question label"
                          aria-label={`Question ${i + 1} label`}
                          onChange={(e) => update(i, { label: e.target.value })}
                          aria-invalid={error ? true : undefined}
                        />
                      </div>

                      {field.type === "select" && (
                        <div className="grid gap-2 pl-1">
                          {field.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
                              <Input
                                value={opt}
                                maxLength={80}
                                placeholder={`Option ${oi + 1}`}
                                aria-label={`Option ${oi + 1}`}
                                onChange={(e) =>
                                  update(i, { options: field.options.map((o, k) => (k === oi ? e.target.value : o)) })
                                }
                                className="h-8"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Remove option ${oi + 1}`}
                                disabled={field.options.length <= 2}
                                onClick={() => update(i, { options: field.options.filter((_, k) => k !== oi) })}
                              >
                                <X />
                              </Button>
                            </div>
                          ))}
                          {field.options.length < 20 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="justify-self-start"
                              onClick={() => update(i, { options: [...field.options, ""] })}
                            >
                              <Plus /> Add option
                            </Button>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={field.required}
                            onCheckedChange={(v) => update(i, { required: v })}
                            aria-label="Required"
                          />
                          Required
                        </label>
                        <div className="flex gap-0.5">
                          <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                            <ArrowUp />
                          </Button>
                          <Button type="button" variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === fields.length - 1} onClick={() => move(i, 1)}>
                            <ArrowDown />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Delete question"
                            onClick={() => set("customFields", fields.filter((_, j) => j !== i))}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                      {error && <p className="text-xs text-destructive">{error}</p>}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {fields.length < 10 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FIELD_TYPES.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => add(t.type)}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed p-3 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
                >
                  <t.icon className="size-4" />
                  {t.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">You&apos;ve reached the 10-question limit.</p>
          )}
        </div>

        {/* Live preview */}
        <div className="hidden xl:block">
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">Preview</p>
          <div className="grid gap-3 rounded-xl border bg-background p-4 text-sm">
            <PreviewInput label="Full name" />
            <PreviewInput label="Email" />
            {fields.map((f) =>
              f.type === "checkbox" ? (
                <label key={f.id} className="flex items-center gap-2 text-xs">
                  <Checkbox disabled /> {f.label || "Untitled"} {f.required && <span className="text-destructive">*</span>}
                </label>
              ) : (
                <PreviewInput key={f.id} label={f.label || "Untitled"} required={f.required} tall={f.type === "textarea"} select={f.type === "select"} />
              ),
            )}
            <div className="mt-1 h-8 rounded-md bg-primary" />
          </div>
        </div>
      </div>
    </>
  );
}

function PreviewInput({ label, required, tall, select }: { label: string; required?: boolean; tall?: boolean; select?: boolean }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      <div className={cn("flex items-center justify-end rounded-md border bg-muted/30 px-2", tall ? "h-14" : "h-8")}>
        {select && <ChevronDown className="size-3 text-muted-foreground" />}
      </div>
    </div>
  );
}

function ReviewStep({ state, onEdit }: { state: FormState; onEdit: (step: number) => void }) {
  const startsAt = state.date && state.time ? zonedToUtcIso(state.date, state.time, state.timezone) : null;
  const rows: { label: string; value: React.ReactNode; step: number }[] = [
    { label: "Title", value: state.title || "—", step: 0 },
    {
      label: "Description",
      value: state.description ? <span className="line-clamp-3 whitespace-pre-line">{state.description}</span> : "—",
      step: 0,
    },
    {
      label: "When",
      value: startsAt
        ? `${formatDate(startsAt, state.timezone)} at ${formatTime(startsAt, state.timezone)} · ${formatDuration(state.durationMinutes)}`
        : "—",
      step: 1,
    },
    { label: "Visibility", value: state.visibility === "public" ? "Public" : "Unlisted", step: 2 },
    { label: "Approval", value: state.requiresApproval ? "Required" : "Automatic", step: 2 },
    { label: "Capacity", value: state.capacityEnabled ? `${Number(state.capacity).toLocaleString()} seats` : "Unlimited", step: 2 },
    {
      label: "Questions",
      value: state.customFields.length
        ? state.customFields.map((f) => f.label + (f.required ? " *" : "")).join(", ")
        : "Name and email only",
      step: 3,
    },
  ];

  return (
    <>
      <StepHeader title="Ready to go?" body="Review the details. You can change everything later." />
      <dl className="divide-y rounded-xl border">
        {rows.map((r) => (
          <div key={r.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr_auto] sm:items-start sm:gap-4">
            <dt className="text-sm text-muted-foreground">{r.label}</dt>
            <dd className="min-w-0 text-sm">{r.value}</dd>
            <dd>
              <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => onEdit(r.step)}>
                Edit
              </Button>
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}
