import { P } from "./svg";

/** Tiny trend line for stat cards. Draws in once; still under reduced motion. Decorative. */
export function Sparkline({ data, color = P.teal, className }: { data: number[]; color?: string; className?: string }) {
  if (data.length < 2) return null;
  const w = 120;
  const h = 28;
  const max = Math.max(...data, 1);
  const y = (v: number) => h - 3 - (v / max) * (h - 6);
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${y(v)}`).join(" ");
  return (
    <svg className={["mg-spark", className].filter(Boolean).join(" ")} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={points} fill="none" style={{ stroke: color }} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={w} cy={y(data[data.length - 1])} r="2.6" style={{ fill: color }} />
    </svg>
  );
}

/** Published-event burst for the "Your webinar is live" success moment. Plays once on mount. */
export function PublishArt({ className }: { className?: string }) {
  return (
    <svg className={["mg-pub", className].filter(Boolean).join(" ")} viewBox="0 0 120 80" aria-hidden="true">
      <g className="mg-pub-card">
        <rect x="22" y="16" width="76" height="52" rx="9" style={{ fill: P.card, stroke: P.line }} />
        <path d="M22 25 a9 9 0 0 1 9 -9 h58 a9 9 0 0 1 9 9 v9 h-76z" style={{ fill: P.teal }} />
        <rect x="32" y="44" width="44" height="5" rx="2.5" style={{ fill: P.ink }} />
        <rect x="32" y="54" width="30" height="4" rx="2" style={{ fill: P.mute, opacity: 0.5 }} />
      </g>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <line
            key={i}
            x1={60 + Math.cos(a) * 44}
            y1={42 + Math.sin(a) * 34}
            x2={60 + Math.cos(a) * 54}
            y2={42 + Math.sin(a) * 42}
            className="mg-ray"
            style={{ stroke: P.teal, animationDelay: `${0.35 + i * 0.04}s` }}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        );
      })}
      <g className="mg-pub-check">
        <circle cx="92" cy="18" r="12" style={{ fill: "oklch(0.52 0.1 155)" }} />
        <path d="M86.5 18 l4 4 l7 -8" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
