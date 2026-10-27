import Link from "next/link";
import { ArrowRight, Plus, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import type { OnboardingStep } from "@/components/dashboard/onboarding-checklist";
import type { MyPlan } from "@/lib/billing/plans";
import type { listHostWebinars } from "@/lib/webinars/queries";

type Webinar = Awaited<ReturnType<typeof listHostWebinars>>[number];

/**
 * The first-run steps for /onboarding and the dashboard. Each "done" is derived
 * from data, never from a stored flag, so it can't drift from reality.
 */
export function buildOnboardingSteps(webinars: Webinar[], plan: MyPlan, now: number): OnboardingStep[] {
  const draft = webinars.find((w) => w.status === "draft");
  const next = webinars.find((w) => w.status === "scheduled" && new Date(w.startsAt).getTime() > now);
  const published =
    webinars.find((w) => w.status === "live") ?? next ?? webinars.find((w) => w.status !== "draft" && w.status !== "cancelled");
  const totalRegistrations = webinars.reduce((sum, w) => sum + w.registrationCount, 0);

  return [
    {
      id: "create",
      title: "Create your first webinar",
      description: "Pick a title and a time. You can change everything later.",
      done: webinars.length > 0,
      action: (
        <Button asChild size="sm">
          <Link href="/dashboard/webinars/new">
            <Plus /> Create webinar
          </Link>
        </Button>
      ),
    },
    {
      id: "publish",
      title: "Publish it",
      description: "Publishing opens your registration page to the world.",
      done: webinars.some((w) => w.status !== "draft"),
      action: draft && (
        <Button asChild size="sm">
          <Link href={`/dashboard/webinars/${draft.id}`}>
            Review and publish <ArrowRight />
          </Link>
        </Button>
      ),
    },
    {
      id: "share",
      title: "Share your registration page",
      description: "Post the link on Instagram, WhatsApp or your email list. Your first sign-up ticks this off.",
      done: totalRegistrations > 0,
      action: published && <CopyButton value={`/register/${published.id}`} size="sm" label="Copy registration link" />,
    },
    {
      id: "live",
      title: "Go live for the first time",
      description: "Open the studio, check your camera and mic, then press Go live.",
      done: plan.webinarsRun > 0 || webinars.some((w) => w.status === "live" || w.status === "ended"),
      action: published && (
        <Button asChild size="sm">
          <Link href={`/room/${published.id}`}>
            <Video /> Open the studio
          </Link>
        </Button>
      ),
    },
  ];
}
