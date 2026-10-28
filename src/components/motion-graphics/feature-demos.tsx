import type { ReactNode } from "react";
import { MotionScene } from "./motion-scene";
import { CoverGradient, Cursor, DropShadow, P, SceneStyles, Txt, Wave, ink } from "./svg";
import { Timeline } from "./timeline";

/* Feature demos (8 s loops). One timeline, so every demo shares one hoisted <style>. */
const tl = new Timeline(8);
const dOut = 7.4;
const SH = "url(#mgd-sh)";
const COV = "url(#mgd-cov)";

/** Cursor glides in from `from`, clicks, fades. Times: appear, arrive, press, gone. */
const click = (name: string, from: string, [t0, arrive, down, gone]: [number, number, number, number]) =>
  tl.path(name, [
    [0, `opacity:0;transform:${from}`],
    [t0, `opacity:0;transform:${from}`],
    [Math.round((t0 + 0.15) * 100) / 100, `opacity:1;transform:${from}`],
    [arrive, "opacity:1;transform:translate(0,0)"],
    [down, "opacity:1;transform:scale(.85)"],
    [gone, "opacity:0"],
    [8, "opacity:0"],
  ]);
/** Button press: scale down at `down`, back at `up`. */
const press = (name: string, t: number, down: number, up: number, scale: string) =>
  tl.path(name, [
    [0, "transform:scale(1)"],
    [t, "transform:scale(1)"],
    [down, `transform:scale(${scale})`],
    [up, "transform:scale(1)"],
    [8, "transform:scale(1)"],
  ]);
const ripple = (name: string, t: number, peak: string) =>
  tl.path(name, [
    [0, "opacity:0;transform:scale(.2)"],
    [t, "opacity:0;transform:scale(.2)"],
    [t + 0.05, `opacity:${peak};transform:scale(.4)`],
    [t + 0.5, "opacity:0;transform:scale(1.8)"],
    [8, "opacity:0;transform:scale(1.8)"],
  ]);
const floatUp = (name: string, t: number) =>
  tl.path(name, [
    [0, "opacity:0;transform:translateY(0) scale(.6)"],
    [t, "opacity:0;transform:translateY(0) scale(.6)"],
    [t + 0.2, "opacity:1;transform:translateY(-8px) scale(1.05)"],
    [t + 1.4, "opacity:0;transform:translateY(-64px) scale(1)"],
    [8, "opacity:0;transform:translateY(-64px)"],
  ]);

function registration(): ReactNode {
  return (
    <>
      <g filter={SH}>
        <rect x="60" y="14" width="200" height="172" rx="14" style={{ fill: P.card, stroke: P.line }} />
      </g>
      <Txt x={76} y={38} s={11} style={ink(P.ink, 700)}>
        Save your seat
      </Txt>
      <Txt x={76} y={54} s={8.5} style={{ fill: P.mute }}>
        Growth Masterclass · Fri 7 PM
      </Txt>
      <Txt x={76} y={74} s={8} style={ink(P.mute, 500)}>
        Full name
      </Txt>
      <rect x="76" y="78" width="168" height="20" rx="6" style={{ fill: P.card, stroke: P.line }} />
      <g {...tl.a(tl.grow("mgdra", 0.5, dOut, "X", 0.9), "mg-ox")}>
        <Txt x={84} y={92} s={9} style={{ fill: P.ink }}>
          Priya Sharma
        </Txt>
      </g>
      <Txt x={76} y={114} s={8} style={ink(P.mute, 500)}>
        Email
      </Txt>
      <rect x="76" y="118" width="168" height="20" rx="6" style={{ fill: P.card, stroke: P.line }} />
      <g {...tl.a(tl.grow("mgdrb", 1.5, dOut, "X", 1.0), "mg-ox")}>
        <Txt x={84} y={132} s={9} style={{ fill: P.ink }}>
          priya@example.com
        </Txt>
      </g>
      <g {...tl.a(press("mgdrp", 2.9, 3.05, 3.25, ".95"))}>
        <rect x="76" y="148" width="168" height="24" rx="8" style={{ fill: P.pri }} />
        <Txt x={160} y={164} s={9.5} style={ink(P.priF, 600)} anchor="middle">
          Register now
        </Txt>
      </g>
      <g {...tl.a(click("mgdrc", "translate(60px,30px)", [2.3, 2.95, 3.1, 3.4]), "mg-transient")}>
        <Cursor d="M170 160 l0 14 l3.5 -3.5 l3 6 l2.6 -1.2 l-3 -6 l5 0z" />
      </g>
      <g {...tl.a(tl.win("mgdrs", 3.5, dOut, "scale(.96)", 0.3))}>
        <rect x="60" y="14" width="200" height="172" rx="14" style={{ fill: P.card }} />
        <circle cx="160" cy="78" r="24" style={{ fill: P.tealS }} />
        <path
          d="M149 78 l8 8 l14 -15"
          fill="none"
          strokeWidth="3.5"
          strokeLinecap="round"
          {...tl.a(tl.draw("mgdrk", 3.8, dOut, 34, 0.5), "", { stroke: P.teal, strokeDasharray: 34 })}
        />
        <Txt x={160} y={124} s={12} style={ink(P.ink, 700)} anchor="middle">
          You&apos;re registered!
        </Txt>
        <Txt x={160} y={142} s={8.5} style={{ fill: P.mute }} anchor="middle">
          Confirmation sent to priya@example.com
        </Txt>
        <rect x="116" y="152" width="88" height="20" rx="10" style={{ fill: P.soft }} />
        <Txt x={160} y={165} s={8.5} style={ink(P.ink, 500)} anchor="middle">
          Add to calendar
        </Txt>
      </g>
    </>
  );
}

function poll(): ReactNode {
  return (
    <>
      <g filter={SH}>
        <rect x="30" y="16" width="260" height="168" rx="14" style={{ fill: P.card, stroke: P.line }} />
      </g>
      <g {...tl.a(tl.win("mgdph", 0.2, dOut, "translateY(6px)"))}>
        <rect x="46" y="30" width="44" height="16" rx="8" style={{ fill: P.live }} />
        <Txt x={68} y={41} s={8} style={ink("#fff", 700)} anchor="middle">
          LIVE POLL
        </Txt>
        <Txt x={46} y={66} s={11.5} style={ink(P.ink, 600)}>
          Will you launch a funnel this month?
        </Txt>
      </g>
      <rect x="46" y="80" width="228" height="22" rx="7" style={{ fill: P.soft }} />
      <rect x="46" y="80" width="130" height="22" rx="7" {...tl.a(tl.grow("mgdpa", 2.5, dOut, "X", 1.1), "mg-ox", { fill: P.tealS, stroke: P.teal })} />
      <Txt x={56} y={95} s={9.5} style={ink(P.ink, 500)}>
        Yes, this month
      </Txt>
      <rect x="46" y="110" width="228" height="22" rx="7" style={{ fill: P.soft }} />
      <rect
        x="46"
        y="110"
        width="98"
        height="22"
        rx="7"
        {...tl.a(tl.grow("mgdpb", 2.65, dOut, "X", 1.1), "mg-ox", { fill: "oklch(0.95 0.025 160)", stroke: P.sage })}
      />
      <Txt x={56} y={125} s={9.5} style={ink(P.ink, 500)}>
        Not yet
      </Txt>
      <g {...tl.a(tl.win("mgdpp", 3.4, dOut, "translateY(3px)", 0.25))}>
        <Txt x={266} y={95} s={11} style={ink(P.teal, 700)} anchor="end">
          57%
        </Txt>
        <Txt x={266} y={125} s={11} style={ink(P.ink, 700)} anchor="end">
          43%
        </Txt>
        <Txt x={266} y={166} s={9} style={{ fill: P.mute }} anchor="end">
          128 votes
        </Txt>
      </g>
      <Txt x={46} y={144} s={8} style={{ fill: P.mute }}>
        Votes coming in
      </Txt>
      {Array.from({ length: 10 }, (_, i) => (
        <circle
          key={i}
          cx={90 + (i % 5) * 14}
          cy={150 + Math.floor(i / 5) * 12}
          r="4"
          {...tl.a(tl.win(`mgdpv${i}`, 0.9 + i * 0.13, dOut, "scale(0)", 0.15), "", { fill: i % 7 < 4 ? P.teal : P.sage })}
        />
      ))}
    </>
  );
}

function engagement(): ReactNode {
  const msgs: [string, string, number][] = [
    ["Kavya", "This is gold", 0.3],
    ["Rohan", "Can you repeat step 2?", 1.1],
    ["Meera", "Taking notes!", 1.9],
  ];
  return (
    <>
      <g filter={SH}>
        <rect x="20" y="16" width="190" height="168" rx="14" style={{ fill: P.stage }} />
      </g>
      <rect x="32" y="28" width="166" height="96" rx="8" style={{ fill: P.slide }} />
      <rect x="44" y="48" width="100" height="9" rx="4" style={{ fill: P.slideInk }} />
      <rect x="44" y="64" width="70" height="6" rx="3" style={{ fill: P.slideMute }} />
      <rect x="140" y="84" width="50" height="34" rx="6" style={{ fill: P.stage2, stroke: P.teal }} />
      <Wave x={150} y={106} n={4} gap={7} h={8} delay={0.2} />
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={60 + i * 24} cy="150" r="8" style={{ fill: "oklch(0.32 0.016 250)" }} />
      ))}
      <g filter={SH}>
        <rect x="220" y="16" width="86" height="168" rx="12" style={{ fill: P.card, stroke: P.line }} />
      </g>
      <Txt x={230} y={34} s={9} style={ink(P.ink, 600)}>
        Chat
      </Txt>
      {msgs.map(([who, m, t], i) => (
        <g key={who} {...tl.a(tl.win(`mgdem${i}`, t, dOut, "translateX(10px)"))}>
          <rect x="228" y={42 + i * 38} width="70" height="32" rx="7" style={{ fill: P.soft }} />
          <Txt x={234} y={55 + i * 38} s={7.5} style={ink(P.ink, 600)}>
            {who}
          </Txt>
          <Txt x={234} y={67 + i * 38} s={7} style={{ fill: P.mute }}>
            {m.length > 16 ? `${m.slice(0, 15)}…` : m}
          </Txt>
        </g>
      ))}
      {["👏", "❤️", "🔥"].map((e, i) => (
        <g key={e} {...tl.a(floatUp(`mgdee${i}`, 2.5 + i * 0.3), "mg-transient")}>
          <Txt x={176 + i * 10} y={130} s={15}>
            {e}
          </Txt>
        </g>
      ))}
      <g {...tl.a(tl.win("mgdeh", 4.1, dOut, "translateY(10px)"))} filter={SH}>
        <rect x="34" y="136" width="164" height="38" rx="10" style={{ fill: P.card, stroke: P.line }} />
        <circle cx="54" cy="155" r="10" style={{ fill: "oklch(0.95 0.04 85)" }} />
        <Txt x={54} y={159.5} s={12} anchor="middle">
          ✋
        </Txt>
        <Txt x={70} y={152} s={8.5} style={ink(P.ink, 600)}>
          Rahul raised a hand
        </Txt>
        <rect x="70" y="157" width="62" height="12" rx="6" style={{ fill: P.pri }} />
        <Txt x={101} y={166} s={7} style={ink(P.priF, 600)} anchor="middle">
          Invite to stage
        </Txt>
      </g>
    </>
  );
}

function recording(): ReactNode {
  return (
    <>
      <g filter={SH}>
        <rect x="30" y="16" width="260" height="168" rx="14" style={{ fill: P.stage }} />
      </g>
      <rect x="44" y="30" width="232" height="96" rx="8" style={{ fill: P.slide }} />
      <rect x="58" y="54" width="120" height="10" rx="5" style={{ fill: P.slideInk }} />
      <rect x="58" y="72" width="84" height="6" rx="3" style={{ fill: P.slideMute }} />
      <g {...tl.a(tl.win("mgdkr", 0.2, 2.9, "scale(.6)", 0.25), "mg-transient")}>
        <rect x="212" y="38" width="56" height="18" rx="9" style={{ fill: P.live }} />
        <circle cx="224" cy="47" r="3.5" style={{ fill: "#fff" }} className="mg-ping" />
        <Txt x={232} y={51} s={8.5} style={ink("#fff", 700)}>
          REC 42:10
        </Txt>
      </g>
      <g {...tl.a(tl.win("mgdke", 2.9, dOut, "translateY(-6px)", 0.3))}>
        <rect x="44" y="30" width="232" height="96" rx="8" style={{ fill: "oklch(0.21 0.016 250 / .9)" }} />
        <Txt x={160} y={74} s={12} style={ink("#fff", 700)} anchor="middle">
          Webinar ended
        </Txt>
        <Txt x={160} y={92} s={8.5} style={{ fill: P.stageMute }} anchor="middle">
          126 attended · 42 min
        </Txt>
      </g>
      <g filter={SH}>
        <rect x="44" y="136" width="232" height="38" rx="10" style={{ fill: P.card }} />
      </g>
      <rect x="54" y="144" width="22" height="22" rx="6" style={{ fill: P.soft }} />
      <path d="M61 149 l9 6 l-9 6z" style={{ fill: P.mute }} />
      <Txt x={84} y={152} s={8.5} style={ink(P.ink, 600)}>
        Growth Masterclass recording
      </Txt>
      <rect x="84" y="158" width="120" height="6" rx="3" style={{ fill: P.soft }} />
      <rect x="84" y="158" width="120" height="6" rx="3" {...tl.a(tl.grow("mgdkp", 3.4, 5.6, "X", 2.1), "mg-ox mg-transient", { fill: P.amber })} />
      <g {...tl.a(tl.win("mgdkw", 3.3, 5.6, "translateY(2px)", 0.2), "mg-transient")}>
        <Txt x={266} y={166} s={8} style={ink("oklch(0.5 0.12 60)", 600)} anchor="end">
          Processing…
        </Txt>
      </g>
      <g {...tl.a(tl.win("mgdkd", 5.8, dOut, "scale(.7)", 0.25))}>
        <rect x="216" y="154" width="52" height="16" rx="8" style={{ fill: P.okBg }} />
        <Txt x={242} y={165} s={8} style={ink(P.ok, 700)} anchor="middle">
          ✓ Ready
        </Txt>
      </g>
    </>
  );
}

function conversion(): ReactNode {
  return (
    <>
      <g filter={SH}>
        <rect x="14" y="20" width="118" height="160" rx="12" style={{ fill: P.card, stroke: P.line }} />
      </g>
      <Txt x={26} y={40} s={9} style={ink(P.ink, 600)}>
        Host · Offers
      </Txt>
      <rect x="24" y="50" width="98" height="52" rx="8" style={{ fill: P.soft }} />
      <rect x="30" y="56" width="24" height="24" rx="5" fill={COV} />
      <Txt x={60} y={66} s={7.5} style={ink(P.ink, 600)}>
        Accelerator
      </Txt>
      <Txt x={60} y={78} s={7.5} style={{ fill: P.mute }}>
        ₹14,999
      </Txt>
      <g {...tl.a(press("mgdcb", 0.9, 1.0, 1.2, ".94"))}>
        <rect x="24" y="110" width="98" height="22" rx="7" style={{ fill: P.pri }} />
        <Txt x={73} y={125} s={8.5} style={ink(P.priF, 600)} anchor="middle">
          Publish offer
        </Txt>
      </g>
      <g {...tl.a(tl.win("mgdcon", 1.1, dOut, "scale(.6)", 0.25))}>
        <rect x="24" y="140" width="62" height="16" rx="8" style={{ fill: P.tealS }} />
        <Txt x={55} y={151} s={7.5} style={ink(P.teal, 600)} anchor="middle">
          ● On stage
        </Txt>
      </g>
      <path
        d="M132 100 C150 100 150 100 164 100"
        fill="none"
        strokeWidth="2"
        {...tl.a(tl.draw("mgdcl", 1.2, dOut, 32, 0.4), "", { stroke: P.teal, strokeDasharray: 32 })}
      />
      <g filter={SH}>
        <rect x="164" y="20" width="142" height="160" rx="12" style={{ fill: P.stage }} />
      </g>
      <rect x="174" y="30" width="122" height="62" rx="6" style={{ fill: P.slide }} />
      <rect x="184" y="46" width="70" height="7" rx="3.5" style={{ fill: P.slideInk }} />
      <Txt x={296} y={108} s={7.5} style={{ fill: P.stageMute }} anchor="end">
        Attendee view
      </Txt>
      <g {...tl.a(tl.win("mgdco", 1.6, dOut, "translateY(14px)"))}>
        <rect x="174" y="116" width="122" height="54" rx="8" style={{ fill: P.card }} />
        <rect x="180" y="122" width="22" height="22" rx="5" fill={COV} />
        <Txt x={208} y={132} s={7.5} style={ink(P.ink, 600)}>
          Accelerator
        </Txt>
        <Txt x={208} y={143} s={7.5} style={{ fill: P.mute }}>
          ₹14,999
        </Txt>
        <rect x="230" y="150" width="58" height="14" rx="5" style={{ fill: P.pri }} />
        <Txt x={259} y={160} s={7} style={ink(P.priF, 600)} anchor="middle">
          Reserve seat
        </Txt>
        <circle
          cx="259"
          cy="157"
          r="14"
          {...tl.a(ripple("mgdcr", 3.4, ".5"), "mg-transient", { fill: P.teal, transformOrigin: "259px 157px", transformBox: "view-box" })}
        />
      </g>
      <g {...tl.a(click("mgdcc", "translate(30px,30px)", [2.6, 3.3, 3.4, 3.8]), "mg-transient")}>
        <Cursor d="M258 157 l0 12 l3 -3 l2.5 5 l2.3 -1 l-2.4 -5 l4.4 0z" width={1} />
      </g>
      <g {...tl.a(tl.win("mgdck", 4.0, dOut, "translateY(8px) scale(.9)"))}>
        <rect x="186" y="66" width="98" height="20" rx="10" style={{ fill: P.okBg }} />
        <Txt x={235} y={79.5} s={8.5} style={ink(P.ok, 700)} anchor="middle">
          ✓ Seat reserved
        </Txt>
      </g>
    </>
  );
}

const DEMOS = {
  registration: { art: registration(), label: "Animation: someone fills in the registration form, submits it and sees a confirmation." },
  poll: { art: poll(), label: "Animation: a live poll launches, votes arrive and the bars fill to 57% and 43%." },
  engagement: { art: engagement(), label: "Animation: chat messages arrive, emoji reactions float up and an attendee raises a hand." },
  recording: { art: recording(), label: "Animation: recording runs, the webinar ends, the recording processes and becomes ready." },
  conversion: { art: conversion(), label: "Animation: the host publishes an offer, it appears for attendees and one of them reserves a seat." },
};
const CSS = tl.css;

export type FeatureDemoKind = keyof typeof DEMOS;
export const FEATURE_DEMO_KINDS = Object.keys(DEMOS) as FeatureDemoKind[];

/** One looping feature demo (features page, landing page feature grid). */
export function FeatureDemo({ kind, className }: { kind: FeatureDemoKind; className?: string }) {
  const demo = DEMOS[kind];
  return (
    <MotionScene className={["mg-demo", className].filter(Boolean).join(" ")} aria-label={demo.label}>
      <SceneStyles id="demos" css={CSS} />
      <svg viewBox="0 0 320 200" role="img" aria-hidden="true">
        <defs>
          <DropShadow id="mgd-sh" dy={4} blur={6} opacity={0.12} />
          <CoverGradient id="mgd-cov" />
        </defs>
        {demo.art}
      </svg>
    </MotionScene>
  );
}
