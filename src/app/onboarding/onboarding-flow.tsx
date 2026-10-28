"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Briefcase,
  Building2,
  GraduationCap,
  LayoutGrid,
  Magnet,
  MoreHorizontal,
  Plus,
  Presentation,
  User,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Callout } from "@/components/blocks/callout";
import { ChoiceCard } from "@/components/blocks/choices";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveOnboarding } from "./actions";
import { ONBOARDING_GOALS, ONBOARDING_WORK } from "./options";

const WORK_ICONS: Record<string, LucideIcon> = {
  coach: User,
  consultant: Briefcase,
  educator: GraduationCap,
  creator: Video,
  business_owner: Building2,
  other: MoreHorizontal,
};
const GOAL_ICONS: Record<string, LucideIcon> = { live_webinars: Video, teach_online: Presentation, generate_leads: Magnet };

/** Three-step welcome (prototype onboarding): work, goal, then the first thing to do. */
export function OnboardingFlow({
  firstName,
  freeAttendeeLimit,
  initialWork = "",
  initialGoal = "",
}: {
  firstName: string;
  freeAttendeeLimit: number | null;
  initialWork?: string;
  initialGoal?: string;
}) {
  const [step, setStep] = useState(1);
  const [work, setWork] = useState(initialWork);
  const [goal, setGoal] = useState(initialGoal);
  const [saved, setSaved] = useState<boolean | null>(null);
  const [saving, startSaving] = useTransition();

  function finishQuestions() {
    startSaving(async () => {
      const res = await saveOnboarding({ work, goal });
      setSaved(res.ok);
      setStep(3);
    });
  }

  const label = (list: readonly { value: string; label: string }[], v: string) => list.find((o) => o.value === v)?.label ?? v;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Step {step} of 3</span>
          {step === 3 && <span>Done</span>}
        </div>
        <div role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step} className="h-2 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-teal transition-[width] duration-[360ms] ease-out" style={{ width: `${(step / 3) * 100}%` }} />
        </div>
      </div>

      <div key={step} className="flex flex-col gap-6 motion-safe:animate-[route-in_260ms_var(--ease-out)_both]">
        {step === 1 && (
          <>
            <div className="grid gap-2">
              <h1 className="t-h2">What best describes your work?</h1>
              <p className="text-muted-foreground">We&apos;ll use this to suggest examples that fit you.</p>
            </div>
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="sr-only">Your work</legend>
              {ONBOARDING_WORK.map((o) => (
                <ChoiceCard key={o.value} name="work" value={o.value} checked={work === o.value} onChange={setWork} icon={WORK_ICONS[o.value]} title={o.label} className="px-3" />
              ))}
            </fieldset>
            <div className="flex justify-end">
              <Button cta disabled={!work} onClick={() => setStep(2)}>
                Continue
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid gap-2">
              <h1 className="t-h2">What do you mainly want to do?</h1>
              <p className="text-muted-foreground">Pick the one that matters most. You can do all of them.</p>
            </div>
            <fieldset className="grid gap-2">
              <legend className="sr-only">Your main goal</legend>
              {ONBOARDING_GOALS.map((o) => (
                <ChoiceCard key={o.value} name="goal" value={o.value} checked={goal === o.value} onChange={setGoal} icon={GOAL_ICONS[o.value]} title={o.label} />
              ))}
            </fieldset>
            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button cta disabled={!goal} loading={saving} onClick={finishQuestions}>
                Continue
              </Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="grid gap-2">
              <h1 className="t-h2">You&apos;re all set, {firstName}</h1>
              <p className="text-muted-foreground">
                {freeAttendeeLimit
                  ? `Your Free plan includes one webinar with up to ${freeAttendeeLimit} attendees. What would you like to do first?`
                  : "What would you like to do first?"}
              </p>
            </div>
            <div className="grid gap-2">
              <NextChoice
                href="/dashboard/webinars/new"
                icon={Plus}
                primary
                title="Create my first webinar"
                text="Five short steps. Takes about five minutes."
              />
              <NextChoice href="/dashboard" icon={LayoutGrid} title="Explore my dashboard" text="Look around first. You can create a webinar any time." />
            </div>
            {saved === true && (
              <Callout tone="success">
                Saved: {label(ONBOARDING_WORK, work)} · {label(ONBOARDING_GOALS, goal)}
              </Callout>
            )}
            {saved === false && <Callout tone="warn">We couldn&apos;t save your answers. That&apos;s fine: you can carry on.</Callout>}
            <Button variant="ghost" className="w-fit" onClick={() => setStep(2)}>
              Back
            </Button>
          </>
        )}
      </div>

      <Link href="/dashboard" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        Skip for now and go to the dashboard
      </Link>
    </div>
  );
}

function NextChoice({ href, icon: Icon, title, text, primary }: { href: string; icon: LucideIcon; title: string; text: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3.5 transition-[border-color,box-shadow,transform] duration-[220ms] ease-out hover:-translate-y-0.5 hover:border-input hover:shadow-raise focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:hover:translate-y-0"
    >
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-md", primary ? "bg-primary text-primary-foreground" : "bg-muted")}>
        <Icon aria-hidden className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{text}</span>
      </span>
    </Link>
  );
}
