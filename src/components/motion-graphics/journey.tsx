import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { MotionScene } from "./motion-scene";
import { Av, CoverGradient, Cursor, P, SceneStyles, Txt, Wave, ink } from "./svg";
import { Timeline } from "./timeline";

/* How it works: Create → Register → Go live → Engage → Convert (10 s loop, one stage highlighted at a time). */
const tl = new Timeline(10);

const art: ((grad: string) => ReactNode)[] = [
  (grad) => (
    <>
      <rect x="30" y="18" width="100" height="74" rx="10" style={{ fill: P.card, stroke: P.line }} />
      <path d="M30 28 a10 10 0 0 1 10 -10 h80 a10 10 0 0 1 10 10 v14 h-100z" fill={`url(#${grad})`} />
      <rect x="40" y="52" width="66" height="7" rx="3.5" {...tl.a(tl.grow("mgj0a", 0.3, 9.4), "mg-ox", { fill: P.ink })} />
      <rect x="40" y="65" width="44" height="6" rx="3" {...tl.a(tl.grow("mgj0b", 0.5, 9.4), "mg-ox", { fill: P.mute, opacity: 0.5 })} />
      <g {...tl.a(tl.win("mgj0c", 0.9, 9.4, "scale(.4)"))}>
        <circle cx="122" cy="84" r="11" style={{ fill: P.pri }} />
        <path d="M117 84 l3.5 3.5 l6.5 -7" fill="none" style={{ stroke: P.priF }} strokeWidth="2" strokeLinecap="round" />
      </g>
    </>
  ),
  () => (
    <>
      <rect x="34" y="14" width="92" height="82" rx="10" style={{ fill: P.card, stroke: P.line }} />
      <rect x="44" y="26" width="72" height="12" rx="4" style={{ fill: P.soft }} />
      <rect x="47" y="30" width="44" height="4" rx="2" {...tl.a(tl.grow("mgj1a", 2.3, 9.4), "mg-ox", { fill: P.ink })} />
      <rect x="44" y="44" width="72" height="12" rx="4" style={{ fill: P.soft }} />
      <rect x="47" y="48" width="54" height="4" rx="2" {...tl.a(tl.grow("mgj1b", 2.6, 9.4), "mg-ox", { fill: P.ink })} />
      <rect x="44" y="64" width="72" height="16" rx="6" style={{ fill: P.pri }} />
      <Txt x={80} y={75} s={7.5} style={ink(P.priF, 600)} anchor="middle">
        Register now
      </Txt>
      {["P", "R", "K"].map((l, i) => (
        <Av key={l} cx={26} cy={40 + i * 20} r={8} i={i} letters={l} {...tl.a(tl.win(`mgj1v${i}`, 3.0 + i * 0.25, 9.4, "translateX(-10px) scale(.5)"))} />
      ))}
    </>
  ),
  () => (
    <>
      <rect x="20" y="16" width="120" height="78" rx="10" style={{ fill: P.stage }} />
      <rect x="28" y="26" width="76" height="52" rx="6" style={{ fill: P.slide }} />
      <rect x="36" y="38" width="48" height="6" rx="3" style={{ fill: P.slideInk }} />
      <rect x="36" y="50" width="36" height="4" rx="2" style={{ fill: P.slideMute }} />
      <rect x="108" y="54" width="26" height="24" rx="5" style={{ fill: P.stage2, stroke: P.teal }} />
      <Wave x={114} y={70} n={3} gap={5} w={2.5} h={5} delay={0.2} />
      <g {...tl.a(tl.win("mgj2a", 4.2, 9.4, "scale(.4)"))}>
        <rect x="106" y="22" width="28" height="12" rx="6" style={{ fill: P.live }} />
        <Txt x={120} y={31} s={7} style={ink("#fff", 700)} anchor="middle">
          LIVE
        </Txt>
      </g>
    </>
  ),
  () => (
    <>
      <rect x="26" y="14" width="108" height="82" rx="10" style={{ fill: P.card, stroke: P.line }} />
      <Txt x={36} y={30} s={8} style={ink(P.ink, 600)}>
        Poll
      </Txt>
      <rect x="36" y="38" width="88" height="10" rx="4" style={{ fill: P.soft }} />
      <rect x="36" y="38" width="58" height="10" rx="4" {...tl.a(tl.grow("mgj3a", 6.3, 9.4, "X", 0.9), "mg-ox", { fill: P.teal })} />
      <rect x="36" y="54" width="88" height="10" rx="4" style={{ fill: P.soft }} />
      <rect x="36" y="54" width="30" height="10" rx="4" {...tl.a(tl.grow("mgj3b", 6.45, 9.4, "X", 0.9), "mg-ox", { fill: P.sage })} />
      <g {...tl.a(tl.win("mgj3c", 6.9, 9.4, "translateY(6px)"))}>
        <rect x="36" y="70" width="62" height="16" rx="8" style={{ fill: P.tealS }} />
        <Txt x={44} y={81} s={7.5} style={ink(P.teal, 600)}>
          Great point!
        </Txt>
      </g>
      <g
        {...tl.a(
          tl.path("mgj3e", [
            [0, "opacity:0;transform:translateY(0)"],
            [7.0, "opacity:0;transform:translateY(0)"],
            [7.2, "opacity:1;transform:translateY(-6px)"],
            [8.2, "opacity:0;transform:translateY(-34px)"],
            [10, "opacity:0;transform:translateY(-34px)"],
          ]),
        )}
      >
        <Txt x={110} y={84} s={13}>
          👏
        </Txt>
      </g>
    </>
  ),
  (grad) => (
    <>
      <rect x="26" y="20" width="108" height="70" rx="10" style={{ fill: P.card, stroke: P.line }} />
      <rect x="34" y="28" width="30" height="30" rx="6" fill={`url(#${grad})`} />
      <Txt x={70} y={38} s={8} style={ink(P.ink, 600)}>
        Accelerator
      </Txt>
      <Txt x={70} y={52} s={8.5} style={ink(P.ink, 700)}>
        ₹14,999
      </Txt>
      <rect x="70" y="64" width="56" height="16" rx="6" style={{ fill: P.pri }} />
      <Txt x={98} y={75} s={7.5} style={ink(P.priF, 600)} anchor="middle">
        Reserve
      </Txt>
      <g {...tl.a(tl.win("mgj4a", 8.6, 9.6, "translateY(6px) scale(.8)", 0.25))}>
        <rect x="34" y="64" width="30" height="16" rx="8" style={{ fill: P.tealS }} />
        <Txt x={49} y={75} s={7.5} style={ink(P.teal, 700)} anchor="middle">
          +1 ✓
        </Txt>
      </g>
      <g
        {...tl.a(
          tl.path("mgj4c", [
            [0, "opacity:0;transform:translate(24px,20px)"],
            [8.0, "opacity:0;transform:translate(24px,20px)"],
            [8.15, "opacity:1;transform:translate(24px,20px)"],
            [8.5, "opacity:1;transform:translate(0,0)"],
            [8.6, "opacity:1;transform:scale(.85)"],
            [9.3, "opacity:0"],
            [10, "opacity:0"],
          ]),
        )}
      >
        <Cursor d="M100 72 l0 12 l3 -3 l2.5 5 l2.4 -1 l-2.4 -5 l4.5 0z" width={1} />
      </g>
    </>
  ),
];

// Copy describes what the product does today. `soon` stages show the approved art with a "Soon" label.
const STAGES = [
  ["Create", "Set the title, date and your registration questions in five short steps."],
  ["Register", "People sign up from your page and get reminders."],
  ["Go live", "Present slides or your screen from the browser."],
  ["Engage", "Chat, Q&A, polls and reactions keep people with you."],
  ["Convert", "Show your offer at the right moment and see who clicks.", "soon"],
].map(([title, text, soon], i) => ({
  title,
  text,
  soon: soon === "soon",
  highlight: tl.win(`mgjs${i}`, i * 2, i * 2 + 1.8, "scale(.98)", 0.3),
  line: tl.grow(`mgjl${i}`, i * 2 + 1.4, 9.6, "X", 0.6),
  gradient: `mgj-cov${i}`,
}));
// Build the art now so every keyframe is registered before the CSS is read.
const ART = STAGES.map((s, i) => art[i](s.gradient));
const CSS = tl.css;

/** Five-stage webinar journey for the "How it works" page. */
export function JourneyScene({ className }: { className?: string }) {
  return (
    <MotionScene
      as="div"
      role="img"
      aria-label="Animation of the webinar journey: create, register, go live, engage, convert."
      className={["mg-journey", className].filter(Boolean).join(" ")}
    >
      <SceneStyles id="journey" css={CSS} />
      {STAGES.map((s, i) => (
        <div key={s.title} className="mgj-stage">
          <div className="mgj-card">
            <div {...tl.a(s.highlight, "mgj-hl")} />
            <svg viewBox="0 0 160 110" aria-hidden="true">
              <defs>
                <CoverGradient id={s.gradient} />
              </defs>
              {ART[i]}
            </svg>
          </div>
          <div className="mgj-text">
            <span className="mgj-n">{i + 1}</span>
            <b>
              {s.title}
              {s.soon && <Badge className="ml-2 h-5 align-middle text-[11px]">Soon</Badge>}
            </b>
            <p>{s.text}</p>
          </div>
          {i < STAGES.length - 1 && (
            <div className="mgj-line">
              <span {...tl.a(s.line, "mg-ox")} />
            </div>
          )}
        </div>
      ))}
    </MotionScene>
  );
}
