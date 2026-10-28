import { MotionScene } from "./motion-scene";
import { Av, CoverGradient, Cursor, DropShadow, P, SceneStyles, Txt, Wave, ink } from "./svg";
import { Timeline } from "./timeline";

/* Landing hero: Create → Invite → Present → Engage → Convert (10 s loop). */
const tl = new Timeline(10);
const out = 9.45;
const k = {
  card: tl.win("mgh-card", 0.1, out, "translateY(12px) scale(.96)"),
  l1: tl.grow("mgh-l1", 0.55, out),
  l2: tl.grow("mgh-l2", 0.75, out),
  date: tl.win("mgh-date", 0.95, out, "scale(.6)"),
  pub: tl.win("mgh-pub", 1.45, out, "scale(.5)"),
  c1: tl.draw("mgh-c1", 1.7, out, 60),
  env: tl.path("mgh-env", [
    [0, "opacity:0;transform:translate(0,0)"],
    [1.85, "opacity:0;transform:translate(0,0)"],
    [2.0, "opacity:1;transform:translate(0,0)"],
    [2.55, "opacity:1;transform:translate(0,46px)"],
    [2.7, "opacity:0;transform:translate(0,52px)"],
    [10, "opacity:0;transform:translate(0,52px)"],
  ]),
  inv: tl.win("mgh-inv", 1.9, out),
  n1: tl.win("mgh-n1", 2.35, 2.75, "translateY(4px)", 0.15),
  n2: tl.win("mgh-n2", 2.9, 3.25, "translateY(4px)", 0.15),
  n3: tl.win("mgh-n3", 3.4, out, "translateY(4px)", 0.15),
  c2: tl.draw("mgh-c2", 3.45, out, 120),
  dim: tl.path("mgh-dim", [
    [0, "opacity:.62"],
    [3.7, "opacity:.62"],
    [4.1, "opacity:0"],
    [9.6, "opacity:0"],
    [10, "opacity:.62"],
  ]),
  live: tl.win("mgh-live", 4.0, out, "scale(.5)"),
  s1: tl.grow("mgh-s1", 4.2, out),
  s2: tl.grow("mgh-s2", 4.4, out),
  s3: tl.grow("mgh-s3", 4.55, out),
  s4: tl.grow("mgh-s4", 4.7, out),
  tile: tl.win("mgh-tile", 4.15, out, "scale(.85)"),
  watch: tl.win("mgh-watch", 4.35, out),
  ch1: tl.win("mgh-ch1", 5.0, out, "translateX(12px)"),
  ch2: tl.win("mgh-ch2", 5.55, out, "translateX(12px)"),
  ch3: tl.win("mgh-ch3", 6.2, out, "translateX(12px)"),
  poll: tl.win("mgh-poll", 6.0, 7.75, "translateY(14px)"),
  b1: tl.grow("mgh-b1", 6.45, 7.75, "X", 0.9),
  b2: tl.grow("mgh-b2", 6.6, 7.75, "X", 0.9),
  pct: tl.win("mgh-pct", 7.15, 7.75, "translateY(3px)", 0.2),
  e1: tl.path("mgh-e1", [
    [0, "opacity:0;transform:translateY(0) scale(.6)"],
    [6.9, "opacity:0;transform:translateY(0) scale(.6)"],
    [7.1, "opacity:1;transform:translateY(-10px) scale(1.05)"],
    [8.1, "opacity:0;transform:translateY(-70px) scale(1)"],
    [10, "opacity:0;transform:translateY(-70px)"],
  ]),
  e2: tl.path("mgh-e2", [
    [0, "opacity:0;transform:translateY(0) scale(.6)"],
    [7.15, "opacity:0;transform:translateY(0) scale(.6)"],
    [7.35, "opacity:1;transform:translateY(-12px) scale(1.05)"],
    [8.4, "opacity:0;transform:translateY(-80px) scale(1)"],
    [10, "opacity:0;transform:translateY(-80px)"],
  ]),
  offer: tl.win("mgh-offer", 8.0, out, "translateY(16px)"),
  cur: tl.path("mgh-cur", [
    [0, "opacity:0;transform:translate(70px,60px)"],
    [8.3, "opacity:0;transform:translate(70px,60px)"],
    [8.45, "opacity:1;transform:translate(70px,60px)"],
    [8.95, "opacity:1;transform:translate(0,0)"],
    [9.05, "opacity:1;transform:translate(0,0) scale(.85)"],
    [9.2, "opacity:1;transform:translate(0,0) scale(1)"],
    [9.5, "opacity:0;transform:translate(0,0)"],
    [10, "opacity:0"],
  ]),
  rip: tl.path("mgh-rip", [
    [0, "opacity:0;transform:scale(.2)"],
    [9.0, "opacity:0;transform:scale(.2)"],
    [9.05, "opacity:.55;transform:scale(.4)"],
    [9.5, "opacity:0;transform:scale(1.8)"],
    [10, "opacity:0;transform:scale(1.8)"],
  ]),
  rev: tl.win("mgh-rev", 9.1, 9.75, "translateY(10px)", 0.2),
  c4: tl.draw("mgh-c4", 8.9, 9.6, 400, 0.4),
};
const AVATARS = ["PS", "RV", "KN", "AM", "SI"].map((n, i) => ({ n, name: tl.win(`mgh-av${i}`, 2.25 + i * 0.22, out, "scale(.3)") }));
const CAPTIONS = ["Create webinar", "Invite audience", "Present live", "Engage attendees", "Convert customers"].map((c, i) => ({
  c,
  name: tl.win(`mgh-cap${i}`, i * 2, i * 2 + 1.75, "scale(.96)", 0.25),
}));
const CHAT: [string, string, string][] = [
  ["Kavya", "So clear, thank you!", k.ch1],
  ["Rohan", "Works for B2B too?", k.ch2],
  ["Ananya · Host", "Yes! Example next.", k.ch3],
];
const CSS = tl.css;

const C1 = "M116 150 C116 168 116 172 116 188";
const C2 = "M216 236 C236 236 228 150 248 150";
const C4 = "M380 312 C380 350 300 336 216 336";

/** Landing page hero story. Decorative; the label describes it for screen readers. */
export function HeroScene({ className }: { className?: string }) {
  return (
    <MotionScene
      className={["mg-hero", className].filter(Boolean).join(" ")}
      aria-label="Animation: a coach creates a webinar, invites an audience, presents live, engages attendees with chat and a poll, then converts a customer with an offer."
    >
      <SceneStyles id="hero" css={CSS} />
      <svg viewBox="0 0 640 430" role="img" aria-hidden="true">
        <defs>
          <DropShadow id="mgh-sh" />
          <CoverGradient id="mgh-cov" />
        </defs>
        {/* connectors (always faintly visible; a bright segment draws in as the story advances) */}
        <g fill="none" strokeLinecap="round">
          {[C1, C2, C4].map((d) => (
            <path key={d} d={d} style={{ stroke: P.line }} strokeWidth="2" strokeDasharray="3 5" />
          ))}
          <path d={C1} {...tl.a(k.c1, "", { stroke: P.teal, strokeDasharray: 60 })} strokeWidth="2.5" />
          <path d={C2} {...tl.a(k.c2, "", { stroke: P.teal, strokeDasharray: 120 })} strokeWidth="2.5" />
          <path d={C4} {...tl.a(k.c4, "", { stroke: P.teal, strokeDasharray: 400 })} strokeWidth="2.5" />
          <circle r="3" className="mg-flow mg-transient" style={{ fill: P.teal, offsetPath: `path('${C2}')` }} />
        </g>

        {/* 1 Create: event card */}
        <g {...tl.a(k.card)} filter="url(#mgh-sh)">
          <rect x="16" y="18" width="200" height="132" rx="14" style={{ fill: P.card, stroke: P.line }} />
          <path d="M16 32 a14 14 0 0 1 14 -14 h172 a14 14 0 0 1 14 14 v36 h-200z" fill="url(#mgh-cov)" />
          <circle cx="190" cy="40" r="16" style={{ fill: "oklch(0.78 0.1 80)", opacity: 0.9 }} />
          <circle cx="170" cy="62" r="8" style={{ fill: "oklch(0.95 0.03 185)", opacity: 0.8 }} />
          <Txt x={28} y={46} s={9} style={ink("#fff", 700, { letterSpacing: ".08em" })}>
            LIVE WEBINAR
          </Txt>
          <rect x="28" y="80" width="150" height="10" rx="5" {...tl.a(k.l1, "mg-ox", { fill: P.ink })} />
          <rect x="28" y="97" width="104" height="8" rx="4" {...tl.a(k.l2, "mg-ox", { fill: P.mute, opacity: 0.5 })} />
          <g {...tl.a(k.date)}>
            <rect x="28" y="118" width="70" height="20" rx="10" style={{ fill: P.soft }} />
            <Txt x={63} y={132} s={9.5} style={ink(P.ink, 500)} anchor="middle">
              Fri · 7:00 PM
            </Txt>
          </g>
          <g {...tl.a(k.pub)}>
            <rect x="140" y="118" width="64" height="20" rx="10" style={{ fill: P.tealS }} />
            <circle cx="152" cy="128" r="3" style={{ fill: P.teal }} />
            <Txt x={160} y={132} s={9.5} style={ink(P.teal, 600)}>
              Published
            </Txt>
          </g>
        </g>

        {/* envelope travelling down the connector */}
        <g {...tl.a(k.env, "mg-transient")}>
          <rect x="104" y="142" width="24" height="17" rx="3" style={{ fill: P.card, stroke: P.teal }} strokeWidth="1.5" />
          <path d="M105 144 l11 8 l11 -8" fill="none" style={{ stroke: P.teal }} strokeWidth="1.5" />
        </g>

        {/* 2 Invite: audience joins */}
        <g {...tl.a(k.inv)} filter="url(#mgh-sh)">
          <rect x="16" y="188" width="200" height="96" rx="14" style={{ fill: P.card, stroke: P.line }} />
          <Txt x={28} y={208} s={10} style={ink(P.mute, 500)}>
            Registrations
          </Txt>
          {AVATARS.map(({ n, name }, i) => (
            <Av key={n} cx={40 + i * 24} cy={236} r={12} i={i} letters={n} {...tl.a(name)} />
          ))}
          {[
            [k.n1, "12", "mg-transient"],
            [k.n2, "48", "mg-transient"],
          ].map(([name, count, cls]) => (
            <g key={count} {...tl.a(name, cls)}>
              <Txt x={28} y={272} s={12} style={{ fill: P.ink }}>
                <tspan style={{ fontWeight: 700 }}>{count}</tspan> registered
              </Txt>
            </g>
          ))}
          <g {...tl.a(k.n3)}>
            <Txt x={28} y={272} s={12} style={{ fill: P.ink }}>
              <tspan style={{ fontWeight: 700 }}>126</tspan> registered
            </Txt>
            <circle cx="190" cy="268" r="4" className="mg-ping" style={{ fill: P.sage }} />
          </g>
        </g>

        {/* 5 Convert: revenue */}
        <g filter="url(#mgh-sh)">
          <rect x="16" y="304" width="200" height="66" rx="14" style={{ fill: P.card, stroke: P.line }} />
          <Txt x={28} y={324} s={10} style={ink(P.mute, 500)}>
            Offer sales
          </Txt>
          <g {...tl.a(k.rev)}>
            <rect x="26" y="332" width="128" height="26" rx="8" style={{ fill: P.tealS }} />
            <Txt x={36} y={350} s={12.5} style={ink(P.teal, 700)}>
              + ₹14,999 · 1 client
            </Txt>
          </g>
        </g>

        {/* 3 Present: studio */}
        <g filter="url(#mgh-sh)">
          <rect x="240" y="18" width="384" height="352" rx="16" style={{ fill: P.stage }} />
          {[256, 268, 280].map((cx) => (
            <circle key={cx} cx={cx} cy="34" r="4" style={{ fill: "oklch(1 0 0 / .18)" }} />
          ))}
          <Txt x={296} y={38} s={10.5} style={ink(P.stageInk, 600)}>
            Growth Masterclass for Coaches
          </Txt>
          <g {...tl.a(k.live)}>
            <rect x="548" y="26" width="44" height="17" rx="8.5" style={{ fill: P.live }} />
            <circle cx="558" cy="34.5" r="3" style={{ fill: "#fff" }} className="mg-ping" />
            <Txt x={565} y={38.5} s={9} style={ink("#fff", 700)}>
              LIVE
            </Txt>
          </g>
          <g {...tl.a(k.watch)}>
            <Txt x={612} y={38} s={9} style={{ fill: P.stageMute }} anchor="end">
              126
            </Txt>
          </g>
          <rect x="252" y="52" width="250" height="150" rx="10" style={{ fill: P.slide }} />
          <Txt x={266} y={76} s={8.5} style={ink(P.teal, 700, { letterSpacing: ".08em" })}>
            STEP 2 OF 3
          </Txt>
          <rect x="266" y="86" width="170" height="13" rx="4" {...tl.a(k.s1, "mg-ox", { fill: P.slideInk })} />
          <rect x="266" y="106" width="126" height="13" rx="4" {...tl.a(k.s2, "mg-ox", { fill: P.slideInk })} />
          <rect x="266" y="132" width="120" height="7" rx="3.5" {...tl.a(k.s3, "mg-ox", { fill: P.slideMute })} />
          <rect x="266" y="146" width="96" height="7" rx="3.5" {...tl.a(k.s4, "mg-ox", { fill: P.slideMute })} />
          <g {...tl.a(k.tile)}>
            <rect x="420" y="140" width="76" height="54" rx="8" style={{ fill: P.stage2, stroke: P.teal }} strokeWidth="1.5" />
            <circle cx="458" cy="160" r="9" style={{ fill: "oklch(0.42 0.02 250)" }} />
            <path d="M440 194 a18 14 0 0 1 36 0z" style={{ fill: "oklch(0.38 0.02 250)" }} />
            <Wave x={428} y={176} n={5} gap={6} />
          </g>
          <rect x="510" y="52" width="104" height="250" rx="10" style={{ fill: P.stage2 }} />
          <Txt x={522} y={70} s={9.5} style={ink(P.stageInk, 600)}>
            Chat
          </Txt>
          {CHAT.map(([n, m, name], i) => (
            <g key={n} {...tl.a(name)}>
              <rect x="518" y={82 + i * 46} width="88" height="38" rx="8" style={{ fill: i === 2 ? "oklch(0.36 0.04 195)" : "oklch(0.3 0.016 250)" }} />
              <Txt x={526} y={97 + i * 46} s={8.5} style={ink(P.stageInk, 600)}>
                {n}
              </Txt>
              <Txt x={526} y={111 + i * 46} s={8} style={{ fill: P.stageMute }}>
                {m}
              </Txt>
            </g>
          ))}

          {/* 4 Engage: poll */}
          <g {...tl.a(k.poll, "mg-transient")}>
            <rect x="252" y="210" width="250" height="92" rx="10" style={{ fill: P.card }} />
            <Txt x={264} y={230} s={10} style={ink(P.ink, 600)}>
              Poll · Which step is hardest?
            </Txt>
            <rect x="264" y="240" width="200" height="16" rx="6" style={{ fill: P.soft }} />
            <rect x="264" y="240" width="114" height="16" rx="6" {...tl.a(k.b1, "mg-ox", { fill: P.tealS, stroke: P.teal })} strokeWidth="1" />
            <Txt x={272} y={252} s={9} style={{ fill: P.ink }}>
              Lead magnet
            </Txt>
            <rect x="264" y="264" width="200" height="16" rx="6" style={{ fill: P.soft }} />
            <rect x="264" y="264" width="86" height="16" rx="6" {...tl.a(k.b2, "mg-ox", { fill: P.tealS, stroke: P.teal })} strokeWidth="1" />
            <Txt x={272} y={276} s={9} style={{ fill: P.ink }}>
              Follow-up
            </Txt>
            <g {...tl.a(k.pct)}>
              <Txt x={492} y={252} s={9.5} style={ink(P.teal, 700)} anchor="end">
                57%
              </Txt>
              <Txt x={492} y={276} s={9.5} style={ink(P.mute, 600)} anchor="end">
                43%
              </Txt>
            </g>
          </g>

          {/* 5 Convert: offer card + click */}
          <g {...tl.a(k.offer)}>
            <rect x="252" y="210" width="250" height="92" rx="10" style={{ fill: P.card }} />
            <rect x="262" y="222" width="56" height="56" rx="8" fill="url(#mgh-cov)" />
            <Txt x={328} y={236} s={10} style={ink(P.ink, 600)}>
              Coaching Accelerator
            </Txt>
            <Txt x={328} y={252} s={8.5} style={{ fill: P.mute }}>
              8-week program · seats open
            </Txt>
            <Txt x={328} y={272} s={11} style={ink(P.ink, 700)}>
              ₹14,999
            </Txt>
            <rect x="414" y="260" width="78" height="24" rx="8" style={{ fill: P.pri }} />
            <Txt x={453} y={276} s={9.5} style={ink(P.priF, 600)} anchor="middle">
              Reserve seat
            </Txt>
            <circle
              cx="453"
              cy="272"
              r="18"
              {...tl.a(k.rip, "mg-transient", { fill: P.teal, transformOrigin: "453px 272px", transformBox: "view-box" })}
            />
          </g>
          <g {...tl.a(k.e1, "mg-transient")}>
            <Txt x={470} y={206} s={18}>
              👏
            </Txt>
          </g>
          <g {...tl.a(k.e2, "mg-transient")}>
            <Txt x={486} y={206} s={18}>
              🔥
            </Txt>
          </g>
          <g {...tl.a(k.cur, "mg-transient")}>
            <Cursor d="M452 272 l0 16 l4 -4 l3 7 l3 -1.4 l-3 -7 l6 0z" width={1.2} />
          </g>

          {/* dock */}
          {[0, 1, 2, 3, 4].map((i) => (
            <circle key={i} cx={312 + i * 26} cy="338" r="10" style={{ fill: "oklch(0.32 0.016 250)" }} />
          ))}
          <rect x="446" y="328" width="44" height="20" rx="10" style={{ fill: P.live, opacity: 0.85 }} />
          <Txt x={468} y={342} s={9} style={ink("#fff", 600)} anchor="middle">
            End
          </Txt>
          <rect x="240" y="18" width="384" height="352" rx="16" {...tl.a(k.dim, "mg-transient", { fill: "var(--background)" })} />
        </g>

        {/* stage captions */}
        {CAPTIONS.map(({ c, name }, i) => (
          <g key={c}>
            <rect x={8 + i * 126} y="390" width="118" height="30" rx="15" style={{ fill: P.soft, stroke: P.line }} />
            <Txt x={67 + i * 126} y={409} s={10.5} style={ink(P.mute, 500)} anchor="middle">
              {`${i + 1}  ${c}`}
            </Txt>
            <g {...tl.a(name, i === 4 ? "" : "mg-transient")}>
              <rect x={8 + i * 126} y="390" width="118" height="30" rx="15" style={{ fill: P.pri }} />
              <Txt x={67 + i * 126} y={409} s={10.5} style={ink(P.priF, 600)} anchor="middle">
                {`${i + 1}  ${c}`}
              </Txt>
            </g>
          </g>
        ))}
      </svg>
    </MotionScene>
  );
}
