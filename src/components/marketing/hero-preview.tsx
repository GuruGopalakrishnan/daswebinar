import { BarChart3, Hand, MessageSquare, Mic, MonitorUp, Users, Video } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";

// Illustrative product shot for the landing page (not live data). Pure CSS so
// it renders instantly and costs no JavaScript.
const EMOJI = ["👏", "🔥", "❤️", "🙌", "👏", "🎉"];

export function HeroPreview() {
  return (
    <div className="relative mx-auto max-w-5xl">
      <div className="relative overflow-hidden rounded-[28px] bg-stage p-3 shadow-[0_40px_120px_-30px_oklch(0.2_0.02_60/0.45)] ring-1 ring-black/10">
        {/* Stage */}
        <div className="relative aspect-[16/9] overflow-hidden rounded-[20px] bg-[radial-gradient(ellipse_at_20%_0%,oklch(0.42_0.06_180/0.55),transparent_60%),radial-gradient(ellipse_at_100%_100%,oklch(0.5_0.08_78/0.35),transparent_55%),oklch(0.17_0.005_60)]">
          {/* Slide */}
          <div className="absolute inset-[7%] right-[30%] rounded-xl bg-[oklch(0.97_0.005_85)] p-[4%] text-[oklch(0.2_0.01_60)] shadow-2xl">
            <p className="text-[clamp(8px,1.1vw,12px)] font-medium tracking-wider text-[oklch(0.5_0.095_182)] uppercase">Module 2</p>
            <p className="mt-2 font-display text-[clamp(16px,3vw,36px)] leading-[1.05]">Turn followers into paying clients</p>
            <div className="mt-[6%] grid grid-cols-3 gap-[4%]">
              {[72, 48, 88].map((h, i) => (
                <div key={i} className="flex aspect-[3/4] items-end rounded-md bg-[oklch(0.94_0.008_80)] p-1">
                  <div className="w-full rounded-sm bg-[oklch(0.5_0.095_182)]" style={{ height: `${h}%`, opacity: 0.55 + i * 0.15 }} />
                </div>
              ))}
            </div>
          </div>

          {/* Presenter camera */}
          <div className="absolute right-[4%] bottom-[18%] aspect-[4/5] w-[22%] overflow-hidden rounded-2xl bg-[linear-gradient(160deg,oklch(0.45_0.05_60),oklch(0.28_0.03_60))] ring-2 ring-white/15">
            <div className="absolute inset-0 flex items-center justify-center">
              <UserAvatar name="Ananya Rao" className="size-[38%] text-[clamp(10px,1.4vw,18px)]" />
            </div>
            <span className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[clamp(7px,0.9vw,11px)] text-white">Ananya · Host</span>
          </div>

          {/* Top bar */}
          <div className="absolute inset-x-[3%] top-[4%] flex items-center justify-between text-[clamp(7px,0.9vw,11px)] text-white">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-live px-2.5 py-1 font-semibold">
              <span className="size-1.5 animate-pulse rounded-full bg-white" /> LIVE · 42:18
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 backdrop-blur">
              <Users className="size-3" /> 128 watching
            </span>
          </div>

          {/* Poll card */}
          <div className="absolute top-[14%] right-[4%] hidden w-[24%] rounded-xl bg-white/95 p-2.5 text-[clamp(7px,0.85vw,11px)] text-[oklch(0.2_0.01_60)] shadow-xl sm:block">
            <p className="font-medium">What&apos;s your biggest blocker?</p>
            {[
              ["Getting leads", 58],
              ["Pricing", 27],
              ["Time", 15],
            ].map(([label, pct]) => (
              <div key={label} className="relative mt-1.5 overflow-hidden rounded-md bg-[oklch(0.95_0.007_80)] px-2 py-1">
                <span className="absolute inset-y-0 left-0 bg-[oklch(0.5_0.095_182/0.25)]" style={{ width: `${pct}%` }} />
                <span className="relative flex justify-between">
                  <span>{label}</span>
                  <span className="tabular-nums">{pct}%</span>
                </span>
              </div>
            ))}
          </div>

          {/* Floating reactions */}
          <div aria-hidden className="pointer-events-none absolute right-[30%] bottom-[14%] h-1/2 w-12">
            {EMOJI.map((e, i) => (
              <span
                key={i}
                className="absolute bottom-0 text-[clamp(14px,2vw,24px)] motion-safe:animate-[float-up_3.6s_ease-out_infinite]"
                style={{ left: `${(i * 23) % 40}px`, animationDelay: `${i * 0.6}s`, opacity: 0 }}
              >
                {e}
              </span>
            ))}
          </div>

          {/* Dock */}
          <div className="absolute bottom-[4%] left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/55 p-1 text-white backdrop-blur-md sm:gap-1.5 sm:p-1.5">
            {[Mic, Video, MonitorUp].map((Icon, i) => (
              <span key={i} className="flex size-[clamp(18px,2.6vw,34px)] items-center justify-center rounded-full bg-white/10">
                <Icon className="size-[45%]" />
              </span>
            ))}
            <span className="mx-0.5 h-4 w-px bg-white/15" />
            {[MessageSquare, BarChart3, Hand].map((Icon, i) => (
              <span key={i} className="relative flex size-[clamp(18px,2.6vw,34px)] items-center justify-center rounded-full">
                <Icon className="size-[45%]" />
                {i === 0 && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-highlight" />}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Chat bubble outside the frame */}
      <div className="absolute -bottom-6 -left-2 hidden w-64 rounded-2xl border bg-card p-3 text-sm shadow-xl md:block lg:-left-10">
        <div className="flex items-start gap-2.5">
          <UserAvatar name="Rahul M" className="size-7 text-[10px]" />
          <div>
            <p className="text-xs text-muted-foreground">Rahul · just now</p>
            <p className="mt-0.5">This framework is gold. Where do I sign up for the program? 🙌</p>
          </div>
        </div>
      </div>
    </div>
  );
}
