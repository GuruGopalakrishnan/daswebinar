import { Cast, Film, Mail, Plus, type LucideIcon } from "lucide-react";
import { MotionScene } from "./motion-scene";
import { P, SceneStyles, Txt, ink } from "./svg";
import { Timeline } from "./timeline";

/* Dashboard empty states: Create → Invite → Go live → Recording (8 s loop, plays twice). */
const tl = new Timeline(8);
const STEPS: { label: string; icon: LucideIcon; name: string; cx: number }[] = [
  { label: "Create", icon: Plus },
  { label: "Invite", icon: Mail },
  { label: "Go live", icon: Cast },
  { label: "Recording", icon: Film },
].map((s, i) => ({ ...s, name: tl.win(`mgl${i}`, i * 2, i * 2 + 1.8, "scale(.9)", 0.3), cx: 30 + i * 66.6 }));
const LINE = tl.draw("mgll", 0.2, 7.6, 220, 7.0);
const CSS = tl.css;

export function LifecycleScene({ className }: { className?: string }) {
  return (
    <MotionScene
      as="div"
      role="img"
      aria-label="Animation: create, invite, go live, recording."
      className={["mg-life", className].filter(Boolean).join(" ")}
    >
      <SceneStyles id="lifecycle" css={CSS} />
      <svg viewBox="0 0 260 90" aria-hidden="true">
        <path d="M30 46 H230" style={{ stroke: P.line }} strokeWidth="3" strokeLinecap="round" />
        <path d="M30 46 H230" fill="none" strokeWidth="3" strokeLinecap="round" {...tl.a(LINE, "", { stroke: P.teal, strokeDasharray: 220 })} />
        {STEPS.map(({ label, icon: Icon, name, cx }) => (
          <g key={label}>
            <circle cx={cx} cy="46" r="16" style={{ fill: P.card, stroke: P.line }} strokeWidth="2" />
            <g {...tl.a(name, "", { transformOrigin: `${cx}px 46px`, transformBox: "view-box" })}>
              <circle cx={cx} cy="46" r="16" style={{ fill: P.pri }} />
              <circle cx={cx} cy="46" r="22" style={{ fill: "none", stroke: P.teal, opacity: 0.35 }} strokeWidth="2" />
            </g>
            <g transform={`translate(${cx - 8} 38) scale(.667)`} style={{ color: P.mute }}>
              <Icon width={24} height={24} strokeWidth={2} aria-hidden />
            </g>
            <Txt x={cx} y={80} s={9.5} style={ink(P.mute, 500)} anchor="middle">
              {label}
            </Txt>
          </g>
        ))}
      </svg>
    </MotionScene>
  );
}
