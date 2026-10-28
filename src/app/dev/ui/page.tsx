import { CalendarDays, Inbox, Radio, Users } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Callout } from "@/components/blocks/callout";
import { KeyValue, Ticks } from "@/components/blocks/lists";
import { SuccessBurst } from "@/components/blocks/success-burst";
import { Advanced, SectionCard, SettingRow, UsageMeter, cardInteractive } from "@/components/blocks/surfaces";
import { Logo } from "@/components/brand/logo";
import { EmptyState } from "@/components/empty-state";
import { FEATURE_DEMO_KINDS, FeatureDemo } from "@/components/motion-graphics/feature-demos";
import { HeroScene } from "@/components/motion-graphics/hero";
import { JourneyScene } from "@/components/motion-graphics/journey";
import { LifecycleScene } from "@/components/motion-graphics/lifecycle";
import { PublishArt, Sparkline } from "@/components/motion-graphics/small";
import { WizardScene } from "@/components/motion-graphics/wizard-scene";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge, PingDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/webinar/status-badge";
import { InteractiveGallery } from "./interactive";

export const metadata: Metadata = { title: "UI gallery", robots: { index: false } };

/**
 * Development-only gallery of the Deploy & Grow components and motion graphics (Phase 1b review).
 * Every value here is placeholder copy for layout review, not data. 404 in production builds.
 */
export default function UiGalleryPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-14 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Logo />
        <Badge variant="sample">Dev gallery · sample copy</Badge>
      </header>

      <Section title="Typography">
        <p className="eyebrow">Overline label</p>
        <p className="t-display">Host better webinars.</p>
        <p className="t-h1">Heading one</p>
        <p className="t-h2">Heading two</p>
        <p className="t-h3">Heading three</p>
        <p className="t-title">Title</p>
        <p className="t-lead">Lead paragraph in muted text for page intros.</p>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button cta>Create webinar</Button>
          <Button>Primary</Button>
          <Button variant="teal">Teal (secondary emphasis)</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button variant="destructive">Delete</Button>
          <Button variant="success">Saved</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg">Large</Button>
          <Button size="sm" variant="outline">
            Small
          </Button>
          <Button size="xs" variant="outline">
            Extra small
          </Button>
          <Button size="icon" variant="outline" aria-label="Users">
            <Users />
          </Button>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap gap-2">
          <Badge>Neutral</Badge>
          <Badge variant="teal">Registered</Badge>
          <Badge variant="success">Approved</Badge>
          <Badge variant="warning">Pending approval</Badge>
          <Badge variant="danger">Rejected</Badge>
          <Badge variant="live">
            <PingDot />
            Live
          </Badge>
          <Badge variant="navy">Pro</Badge>
          <Badge variant="sample">Sample</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["live", "scheduled", "draft", "ended", "cancelled"] as const).map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
      </Section>

      <Section title="Forms, steps and choices (interactive)">
        <InteractiveGallery />
      </Section>

      <Section title="Callouts">
        <div className="grid gap-3">
          <Callout title="Registration is open">Share your page link to start collecting registrations.</Callout>
          <Callout tone="warn" title="80 of 100 seats taken">
            Free plan rooms hold up to 100 attendees.
          </Callout>
          <Callout tone="danger" title="Payment failed" action={<Button size="sm">Try again</Button>}>
            Your card was declined.
          </Callout>
          <Callout tone="success">Changes saved.</Callout>
        </div>
      </Section>

      <Section title="Cards and app blocks">
        <PageHeader
          crumbs={[{ label: "Webinars", href: "#" }, { label: "Growth Masterclass" }]}
          title="Growth Masterclass"
          description="Fri, 31 Oct · 7:00 PM IST"
          actions={<Button cta>Go live</Button>}
          nextStep={
            <>
              Next: <b>share your registration link</b>
            </>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Registrations" value={128} icon={Users} hint="this month" spark={[3, 5, 4, 8, 7, 12, 15]} delta={{ label: "+12%", positive: true }} />
          <StatCard label="Live now" value={1} icon={Radio} tone="live" />
          <StatCard label="Upcoming" value={3} icon={CalendarDays} />
          <StatCard label="Replays" value={0} icon={Inbox} hint="No recordings yet" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Current plan" actions={<Badge>Free</Badge>}>
            <div className="grid gap-4">
              <UsageMeter label="Free webinar used: 1 of 1" used={1} limit={1} description="Past webinars stay in your account on any plan." />
              <Ticks items={["Unlimited webinars", "Unlimited attendees*", "Everything in Free"]} />
            </div>
          </SectionCard>
          <SectionCard title="Settings">
            <SettingRow title="Chat" description="Attendees can send messages." control={<Switch defaultChecked aria-label="Chat" />} />
            <SettingRow title="Q&A" description="Attendees can ask questions." control={<Switch aria-label="Q&A" />} />
            <Advanced title="Advanced options" hint="Optional">
              <KeyValue
                items={[
                  ["Status", <Badge key="s" variant="success">Active</Badge>],
                  ["Renews on", "28 Nov 2026"],
                ]}
              />
            </Advanced>
          </SectionCard>
        </div>
        <a href="#" className={`block rounded-xl border bg-card p-5 shadow-card transition-[box-shadow,transform] duration-[220ms] ${cardInteractive}`}>
          Interactive card (hover lifts)
        </a>
        <SuccessBurst title="Your webinar is published" description="Registrations are open." art="publish" action={<Button variant="outline">Copy link</Button>} />
        <SuccessBurst title="You're on Pro" description="Unlimited webinars are unlocked." />
        <div className="rounded-xl border bg-card shadow-card">
          <EmptyState icon={CalendarDays} title="No webinars yet" description="Create your first webinar to get a registration page." action={<Button cta>Create webinar</Button>} />
        </div>
        <div className="rounded-xl border bg-card shadow-card">
          <EmptyState icon={CalendarDays} art={<LifecycleScene />} title="Nothing scheduled" description="Create, invite, go live, then share the recording." />
        </div>
        <Tabs defaultValue="a">
          <TabsList variant="line">
            <TabsTrigger value="a">Overview</TabsTrigger>
            <TabsTrigger value="b">Registrations</TabsTrigger>
            <TabsTrigger value="c">Recordings</TabsTrigger>
          </TabsList>
        </Tabs>
        <Progress value={60} className="max-w-sm" />
      </Section>

      <Section title="Motion graphics: landing hero">
        <HeroScene />
      </Section>
      <Section title="Motion graphics: how it works">
        <JourneyScene />
      </Section>
      <Section title="Motion graphics: feature demos">
        <div className="mg-demos">
          {FEATURE_DEMO_KINDS.map((k) => (
            <div key={k} className="mg-demo-card rounded-xl border bg-card shadow-card">
              <FeatureDemo kind={k} />
              <p className="p-4 text-sm font-medium capitalize">{k}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Motion graphics: wizard steps (each plays once)">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {([1, 2, 3, 4, 5] as const).map((s) => (
            <WizardScene key={s} step={s} />
          ))}
        </div>
      </Section>
      <Section title="Motion graphics: small">
        <div className="flex flex-wrap items-center gap-8">
          <LifecycleScene />
          <Sparkline data={[2, 4, 3, 6, 5, 9, 11]} />
          <PublishArt />
        </div>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section id={title.toLowerCase().replace(/[^a-z0-9]+/g, "-")} className="grid min-w-0 scroll-mt-4 grid-cols-[minmax(0,1fr)] gap-5">
      <h2 className="t-h3 border-b pb-2">{title}</h2>
      {children}
    </section>
  );
}
