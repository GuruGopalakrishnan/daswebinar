import { Mic, MonitorUp, Plus, Presentation, SmilePlus, Users, Video, BarChart3 } from "lucide-react";
import { Badge, PingDot } from "@/components/ui/badge";
import { StatusBadge } from "@/components/webinar/status-badge";

/* Static product illustrations for marketing pages. Every name and number is illustrative sample copy. */

const WEBINARS = [
  { mon: "Nov", day: "07", title: "Growth Masterclass for Coaches", meta: "48 registered", status: "scheduled" as const },
  { mon: "Nov", day: "14", title: "Pricing Your Offer Workshop", meta: "31 registered", status: "scheduled" as const },
  { mon: "Oct", day: "31", title: "Live Q&A: Building Your First Funnel", meta: "23 in the room", status: "live" as const },
];

/** "Your webinars" list card (webinar management section). */
export function ManagementArt() {
  return (
    <div role="img" aria-label="Illustration: a list of webinars with dates and status" className="overflow-hidden rounded-xl border bg-card shadow-card">
      <div aria-hidden>
        <div className="flex items-center justify-between gap-3 border-b px-6 py-4">
          <b className="font-semibold">Your webinars</b>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
            <Plus className="size-4" />
            Create
          </span>
        </div>
        {WEBINARS.map((w) => (
          <div key={w.title} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-4 border-b px-6 py-3.5 last:border-b-0 max-md:px-4">
            <div className="flex size-12 flex-col items-center justify-center rounded-md border bg-card">
              <span className="text-[11px] tracking-[.06em] text-muted-foreground uppercase">{w.mon}</span>
              <b className="text-lg leading-[22px]">{w.day}</b>
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold">{w.title}</div>
              <div className="text-sm text-muted-foreground">{w.meta}</div>
            </div>
            <StatusBadge status={w.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

const CHAT = [
  ["Kavya N.", "This is so clear, thank you"],
  ["Rohan G.", "Does this work for B2B?"],
  ["Ananya (Host)", "Yes! Example coming up."],
];
const POLL: [string, number][] = [
  ["Lead magnet", 62],
  ["Follow-up", 28],
  ["Booking", 10],
];

/** Dark studio window: slide + presenter PiP, dock, chat and an on-stage poll (features page). */
export function StudioPreview() {
  return (
    <div role="img" aria-label="Preview of the Deploy & Grow webinar studio" className="dark overflow-hidden rounded-2xl border bg-card text-foreground shadow-elevated">
      <div aria-hidden>
        <div className="flex h-9 items-center gap-1.5 border-b bg-muted px-3">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-2.5 rounded-full bg-border" />
          ))}
          <em className="ml-2 font-mono text-xs text-muted-foreground not-italic">webinar.deployandgrow.com/room</em>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_34%] gap-2.5 bg-background p-3">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex min-w-0 items-center gap-2">
                <Badge variant="live" className="h-[18px] text-[10px]">
                  <PingDot />
                  Live
                </Badge>
                <b className="truncate">Growth Masterclass for Coaches</b>
              </span>
              <span className="inline-flex h-5 items-center gap-1 rounded-full bg-muted px-2 text-[10px] font-medium">
                <Users className="size-3" />
                126
              </span>
            </div>
            <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-stage">
              <div className="absolute inset-0 flex flex-col justify-center gap-[3%] bg-[oklch(0.985_0.004_85)] px-[9%] py-[7%] text-[oklch(0.24_0.012_260)]">
                <span className="text-[clamp(9px,1vw,13px)] font-semibold tracking-[.08em] text-[oklch(0.52_0.09_192)] uppercase">Step 2 of 3</span>
                <h3 className="text-[clamp(14px,2vw,24px)] leading-[1.1] font-semibold tracking-[-0.03em]">Turn followers into booked calls</h3>
                <ul className="list-disc pl-[1.2em] text-[clamp(9px,1vw,13px)] leading-[1.45] text-[oklch(0.45_0.012_260)]">
                  <li>One clear lead magnet</li>
                  <li>A 3-email follow-up</li>
                  <li>A single booking link</li>
                </ul>
                <span className="absolute inset-x-0 bottom-0 h-[2%] bg-[oklch(0.27_0.06_262)]" />
              </div>
              <div className="absolute right-2 bottom-2 grid aspect-[16/10] w-[28%] place-items-center overflow-hidden rounded-lg bg-[oklch(0.22_0.02_262)]">
                <span className="absolute top-[22%] left-1/2 aspect-square w-[26%] -translate-x-1/2 rounded-full bg-[oklch(0.38_0.03_262)]" />
                <span className="absolute -bottom-[12%] left-1/2 aspect-[1.3] w-[56%] -translate-x-1/2 rounded-t-full bg-[oklch(0.32_0.03_262)]" />
                <span className="absolute bottom-1 left-1 rounded bg-[oklch(0.13_0.015_262/0.75)] px-1.5 py-px text-[9px] text-[oklch(0.96_0.005_85)]">Ananya</span>
              </div>
            </div>
            <div className="flex justify-center gap-1">
              {[Mic, Video, MonitorUp, Presentation, BarChart3, SmilePlus].map((Icon, i) => (
                <span key={i} className="grid size-[30px] place-items-center rounded-[9px] bg-card">
                  <Icon className="size-3.5" />
                </span>
              ))}
              <span className="inline-flex h-7 items-center rounded-[9px] bg-live px-2.5 text-[10px] font-medium text-white">End</span>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-2.5 text-[11px]">
            <div className="flex gap-2.5 border-b pb-1.5">
              <b>Chat</b>
              <span className="text-muted-foreground">Q&amp;A</span>
              <span className="text-muted-foreground">Polls</span>
            </div>
            {CHAT.map(([n, t]) => (
              <div key={n}>
                <b>{n}</b>
                <div className="text-muted-foreground">{t}</div>
              </div>
            ))}
            <div className="mt-auto flex flex-col gap-1.5 rounded-lg border p-2">
              <b>Poll · Which step is hardest?</b>
              {POLL.map(([t, v]) => (
                <div key={t} className="relative overflow-hidden rounded-[5px] border px-1.5 py-[3px]">
                  <span
                    className="absolute inset-y-0 left-0 origin-left bg-teal-subtle motion-safe:animate-[poll-fill_1.2s_var(--ease-out)_600ms_both]"
                    style={{ width: `${v}%` }}
                  />
                  <span className="relative flex justify-between">
                    <span>{t}</span>
                    <span>{v}%</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
