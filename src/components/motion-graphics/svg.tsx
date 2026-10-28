import type { CSSProperties, ReactNode, SVGProps } from "react";

/** Shared palette. CSS variables keep scenes correct in light and dark themes. */
export const P = {
  card: "var(--card)",
  ink: "var(--foreground)",
  mute: "var(--muted-foreground)",
  line: "var(--border)",
  soft: "var(--muted)",
  teal: "var(--teal)",
  tealS: "var(--teal-subtle)",
  pri: "var(--primary)",
  priF: "var(--primary-foreground)",
  live: "oklch(0.6 0.17 25)",
  amber: "oklch(0.78 0.12 78)",
  stage: "oklch(0.26 0.018 250)",
  stage2: "oklch(0.21 0.016 250)",
  slide: "oklch(0.985 0.004 230)",
  sage: "oklch(0.62 0.07 160)",
  /** Slide headline and body lines (always on a light slide). */
  slideInk: "oklch(0.25 0.015 255)",
  slideMute: "oklch(0.6 0.015 250)",
  /** Text on the dark stage. */
  stageInk: "oklch(0.95 0.006 230)",
  stageMute: "oklch(0.8 0.01 240)",
  ok: "oklch(0.48 0.1 155)",
  okBg: "oklch(0.95 0.03 155)",
} as const;

const AVATAR_COLORS = ["oklch(0.55 0.07 190)", "oklch(0.45 0.06 240)", "oklch(0.56 0.08 300)", "oklch(0.6 0.09 50)", "oklch(0.55 0.07 155)"];

/** Colour + weight shorthand for scene text. */
export const ink = (fill: string, fontWeight?: number, extra?: CSSProperties): CSSProperties => ({ fill, fontWeight, ...extra });

/** Scene text at a fixed size (the `T` helper in the prototype). */
export function Txt({
  x,
  y,
  s,
  style,
  anchor = "start",
  children,
}: {
  x: number;
  y: number;
  s: number;
  style?: CSSProperties;
  anchor?: "start" | "middle" | "end";
  children: ReactNode;
}) {
  return (
    <text x={x} y={y} textAnchor={anchor} style={{ fontSize: `${s}px`, ...style }}>
      {children}
    </text>
  );
}

/** Initials avatar circle. Animation props (from `Timeline.a`) go on the group. */
export function Av({
  cx,
  cy,
  r,
  i,
  letters,
  ...g
}: { cx: number; cy: number; r: number; i: number; letters: string } & SVGProps<SVGGElement>) {
  return (
    <g {...g}>
      <circle cx={cx} cy={cy} r={r} style={{ fill: AVATAR_COLORS[i % 5] }} />
      <text x={cx} y={cy + r * 0.35} textAnchor="middle" style={{ fill: "#fff", fontSize: `${r * 0.82}px`, fontWeight: 600 }}>
        {letters}
      </text>
    </g>
  );
}

/** Pointer cursor used in click moments. `d` places it. */
export function Cursor({ d, width = 1.1 }: { d: string; width?: number }) {
  return <path d={d} style={{ fill: "#fff", stroke: P.slideInk }} strokeWidth={width} />;
}

/** Brand cover gradient (navy → teal) used on event cards. */
export function CoverGradient({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" style={{ stopColor: "oklch(0.45 0.065 205)" }} />
      <stop offset="1" style={{ stopColor: "oklch(0.55 0.07 175)" }} />
    </linearGradient>
  );
}

/** Soft drop shadow filter. */
export function DropShadow({ id, dy = 6, blur = 8, opacity = 0.14 }: { id: string; dy?: number; blur?: number; opacity?: number }) {
  return (
    <filter id={id} x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy={dy} stdDeviation={blur} floodColor="rgb(24 38 56)" floodOpacity={opacity} />
    </filter>
  );
}

/** Mic level bars (looping, CSS only). */
export function Wave({ x, y, n, gap, w = 3, h = 10, delay = 0.18 }: { x: number; y: number; n: number; gap: number; w?: number; h?: number; delay?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <rect
          key={i}
          x={x + i * gap}
          y={y}
          width={w}
          height={h}
          rx={w / 2}
          className="mg-wave"
          style={{ fill: P.teal, animationDelay: `-${i * delay}s` }}
        />
      ))}
    </>
  );
}

/** Hoisted, de-duplicated keyframes for one scene (React 19 `<style precedence>`). The CSS is built from constants. */
export function SceneStyles({ id, css }: { id: string; css: string }) {
  return (
    <style href={`mg-${id}`} precedence="mg">
      {css}
    </style>
  );
}
