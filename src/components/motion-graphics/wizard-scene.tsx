import type { ReactNode } from "react";
import { MotionScene } from "./motion-scene";
import { Av, CoverGradient, P, SceneStyles, Txt, Wave, ink } from "./svg";
import { Timeline } from "./timeline";

/** What the host has entered so far. Every value is optional; text is rendered as plain text. */
export type WizardSceneData = {
  title?: string;
  /** Already formatted for display, e.g. "Fri, 31 Oct". */
  dateLabel?: string;
  capacity?: number | null;
  paid?: boolean;
  /** Formatted price, e.g. "₹499". */
  priceLabel?: string;
  chat?: boolean;
  polls?: boolean;
  qa?: boolean;
  recording?: boolean;
};

const L = 5;
const GRAD = "mgw-cov";
const CAPTIONS = [
  "Your webinar card takes shape.",
  "Choose who can join and how many seats.",
  "Registrants fill your form and get confirmed.",
  "Your room comes together.",
  "Ready to publish.",
];

/* One timeline per step (5 s, plays once when the step opens). */
const TLS = CAPTIONS.map(() => new Timeline(L));

function helpers(step: number) {
  const tl = TLS[step - 1];
  const s = (n: string, a: number, b = L, from = "translateY(6px)") => tl.a(tl.win(`mgw${step}${n}`, a, b, from, 0.3));
  const g = (n: string, a: number, style: React.CSSProperties) => tl.a(tl.grow(`mgw${step}${n}`, a, L), "mg-ox", style);
  return { s, g };
}

function Card({ title }: { title: string }) {
  return (
    <>
      <rect x="40" y="20" width="160" height="92" rx="12" style={{ fill: P.card, stroke: P.line }} />
      <path d="M40 32 a12 12 0 0 1 12 -12 h136 a12 12 0 0 1 12 12 v18 h-160z" fill={`url(#${GRAD})`} />
      <Txt x={52} y={74} s={10} style={ink(P.ink, 600)}>
        {title}
      </Txt>
      <rect x="52" y="84" width="70" height="6" rx="3" style={{ fill: P.mute, opacity: 0.45 }} />
    </>
  );
}

const SCENES: ((d: WizardSceneData, title: string) => ReactNode)[] = [
  (d, title) => {
    const { s, g } = helpers(1);
    return (
      <>
        <g {...s("a", 0.1, L, "translateY(10px) scale(.94)")}>
          <Card title={title} />
        </g>
        <rect x="52" y="84" width="70" height="6" rx="3" {...g("b", 0.7, { fill: P.teal })} />
        <g {...s("c", 1.2, L, "scale(.5)")}>
          <rect x="52" y="94" width="58" height="14" rx="7" style={{ fill: P.soft }} />
          <Txt x={81} y={104} s={7.5} style={ink(P.ink, 500)} anchor="middle">
            {d.dateLabel || "Pick a date"}
          </Txt>
        </g>
      </>
    );
  },
  (d, title) => {
    const { s } = helpers(2);
    return (
      <>
        <g>
          <Card title={title} />
        </g>
        {["PS", "RV", "KN", "AM", "SI", "MP"].map((n, i) => {
          const ang = (i / 6) * Math.PI * 2 - Math.PI / 2;
          return <Av key={n} cx={120 + Math.cos(ang) * 98} cy={66 + Math.sin(ang) * 56} r={10} i={i} letters={n} {...s(`v${i}`, 0.3 + i * 0.25, L, "scale(.3)")} />;
        })}
        <g {...s("k", 1.9, L, "scale(.6)")}>
          <rect x="146" y="86" width="46" height="16" rx="8" style={{ fill: P.tealS }} />
          <Txt x={169} y={97} s={8} style={ink(P.teal, 600)} anchor="middle">
            {d.capacity ? `${d.capacity} seats` : "Seats"}
          </Txt>
        </g>
      </>
    );
  },
  (d) => {
    const { s, g } = helpers(3);
    return (
      <>
        <g>
          <rect x="30" y="14" width="110" height="104" rx="12" style={{ fill: P.card, stroke: P.line }} />
          {[
            [28, 50, "a", 0.3],
            [46, 62, "b", 0.6],
            [64, 38, "c", 0.9],
          ].map(([y, w, n, a]) => (
            <g key={n}>
              <rect x="42" y={y} width="86" height="12" rx="4" style={{ fill: P.soft }} />
              <rect x="45" y={(y as number) + 4} width={w} height="4" rx="2" {...g(n as string, a as number, { fill: P.ink })} />
            </g>
          ))}
          <rect x="42" y="88" width="86" height="18" rx="6" style={{ fill: P.pri }} />
          <Txt x={85} y={100} s={8} style={ink(P.priF, 600)} anchor="middle">
            {d.paid ? "Continue to payment" : "Register now"}
          </Txt>
        </g>
        <g {...s("p", 1.5, L, "translateX(10px)")}>
          <rect x="150" y="34" width="64" height="64" rx="12" style={{ fill: P.card, stroke: P.line }} />
          <circle cx="182" cy="58" r="13" style={{ fill: P.okBg }} />
          <path d="M176 58 l4 4 l8 -8" fill="none" style={{ stroke: P.ok }} strokeWidth="2.5" strokeLinecap="round" />
          <Txt x={182} y={88} s={8.5} style={ink(P.ink, 600)} anchor="middle">
            {d.paid && d.priceLabel ? `${d.priceLabel} paid` : "Confirmed"}
          </Txt>
        </g>
      </>
    );
  },
  (d) => {
    const { s } = helpers(4);
    const features: [string, boolean][] = [
      ["Chat", d.chat ?? true],
      ["Polls", d.polls ?? true],
      ["Q&A", d.qa ?? true],
      ["Recording", d.recording ?? true],
    ];
    return (
      <>
        <g>
          <rect x="30" y="16" width="180" height="100" rx="12" style={{ fill: P.stage }} />
          <rect x="40" y="26" width="116" height="66" rx="6" style={{ fill: P.slide }} />
          <rect x="50" y="42" width="70" height="7" rx="3.5" style={{ fill: P.slideInk }} />
          <rect x="50" y="54" width="50" height="5" rx="2.5" style={{ fill: P.slideMute }} />
          <rect x="162" y="62" width="40" height="30" rx="5" style={{ fill: P.stage2, stroke: P.teal }} />
          <Wave x={172} y={82} n={3} gap={6} h={6} delay={0.2} />
        </g>
        {features.map(([t, on], i) => (
          <g key={t} {...s(`i${i}`, 0.4 + i * 0.35, L, "translateY(8px) scale(.8)")}>
            <rect x={26 + i * 48} y="98" width="44" height="22" rx="11" style={{ fill: on ? P.tealS : P.soft, stroke: on ? P.teal : P.line }} />
            <Txt x={48 + i * 48} y={112.5} s={7.5} style={ink(on ? P.teal : P.mute, 600)} anchor="middle">
              {t}
            </Txt>
          </g>
        ))}
      </>
    );
  },
  (_d, title) => {
    const { s } = helpers(5);
    return (
      <>
        <g>
          <Card title={title} />
        </g>
        <g {...s("b", 0.3, L, "scale(.6)")}>
          <circle cx="186" cy="30" r="16" style={{ fill: P.pri }} />
          <path d="M178 30 l5.5 5.5 l10 -11" fill="none" style={{ stroke: P.priF }} strokeWidth="3" strokeLinecap="round" />
        </g>
        <g {...s("r", 0.9, L, "translateY(8px)")}>
          <rect x="64" y="118" width="112" height="22" rx="11" style={{ fill: P.pri }} />
          <Txt x={120} y={133} s={9} style={ink(P.priF, 600)} anchor="middle">
            Go live soon
          </Txt>
        </g>
        <circle cx="120" cy="129" r="28" className="mg-ring" style={{ fill: "none", stroke: P.teal }} strokeWidth="2" />
      </>
    );
  },
];

// Register every step's keyframes up front (names don't depend on the data).
SCENES.forEach((scene) => scene({}, ""));
const CSS = TLS.map((tl) => tl.css);

/**
 * Illustration beside the create-webinar wizard. Pass `key={step}` from the parent (or rely on the
 * internal key) so it replays once when the step changes, and stays still while the host types.
 */
export function WizardScene({ step, data = {}, className }: { step: 1 | 2 | 3 | 4 | 5; data?: WizardSceneData; className?: string }) {
  const title = (data.title?.trim() || "Your webinar").slice(0, 24);
  return (
    <MotionScene key={step} className={["mg-wiz mg-once", className].filter(Boolean).join(" ")} aria-label={`Illustration for this step: ${CAPTIONS[step - 1]}`}>
      <SceneStyles id={`wizard-${step}`} css={CSS[step - 1]} />
      <svg viewBox="0 0 240 150" aria-hidden="true">
        <defs>
          <CoverGradient id={GRAD} />
        </defs>
        {SCENES[step - 1](data, title)}
      </svg>
      <figcaption>{CAPTIONS[step - 1]}</figcaption>
    </MotionScene>
  );
}
