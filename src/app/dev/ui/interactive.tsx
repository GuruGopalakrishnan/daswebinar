"use client";

import { CalendarClock, Globe, Lock, Zap } from "lucide-react";
import { useState } from "react";
import { ChoiceCard, Segmented, WizardProgress, WizardSteps } from "@/components/blocks/choices";
import { WizardScene } from "@/components/motion-graphics/wizard-scene";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const STEPS = ["Basic details", "Audience access", "Registration & payments", "Experience & follow-up", "Review & publish"].map((label) => ({ label }));

/** Client-side half of the gallery: controls with state, and the wizard scene reacting to input. */
export function InteractiveGallery() {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("scheduled");
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const [chat, setChat] = useState(true);
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-8">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[260px_minmax(0,1fr)_280px]">
        <WizardSteps steps={STEPS} current={step} onSelect={setStep} />
        <div className="grid content-start gap-4 rounded-xl border bg-card p-6 shadow-card">
          <WizardProgress current={step} total={STEPS.length} />
          <label className="grid gap-1.5 text-sm font-medium">
            Webinar title
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Growth Masterclass for Coaches" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Invalid field
            <Input aria-invalid defaultValue="not-an-email" />
            <span className="text-xs font-normal text-destructive">Enter a valid email address.</span>
          </label>
          <div className="flex items-center gap-3 text-sm">
            <Switch id="chat" checked={chat} onCheckedChange={setChat} />
            <label htmlFor="chat">Chat</label>
          </div>
          <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              Back
            </Button>
            <Button cta onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              {step === STEPS.length - 1 ? "Publish webinar" : "Continue"}
            </Button>
          </div>
        </div>
        <WizardScene step={(step + 1) as 1 | 2 | 3 | 4 | 5} data={{ title, chat, capacity: 100, dateLabel: "Fri, 31 Oct" }} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ChoiceCard name="kind" value="instant" checked={kind === "instant"} onChange={setKind} icon={Zap} title="Instant" description="Go live right now." />
        <ChoiceCard name="kind" value="scheduled" checked={kind === "scheduled"} onChange={setKind} icon={CalendarClock} title="Scheduled" description="Pick a date and time." />
        <ChoiceCard name="vis" value="public" checked onChange={() => {}} icon={Globe} title="Public" description="Anyone with the link can register." />
        <ChoiceCard name="vis" value="private" checked={false} onChange={() => {}} icon={Lock} title="Private" description="Disabled example." disabled />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Date range"
          value={range}
          onValueChange={setRange}
          options={[
            { value: "7d", label: "7 days" },
            { value: "30d", label: "30 days" },
            { value: "90d", label: "90 days" },
          ]}
        />
        <Button
          loading={busy}
          onClick={() => {
            setBusy(true);
            setTimeout(() => setBusy(false), 1500);
          }}
        >
          {busy ? "Saving…" : "Save (loading state)"}
        </Button>
      </div>
    </div>
  );
}
