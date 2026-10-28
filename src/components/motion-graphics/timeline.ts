import type { CSSProperties } from "react";

/**
 * Keyframe builders for the Deploy & Grow motion graphics (ported from the approved prototype's motion.js).
 * A scene describes each element as a window of time inside one loop of `T` seconds; the builders turn that
 * into @keyframes. Everything is computed once at module load from constants, so scenes render on the server
 * and ship no per-frame JavaScript. Only transform, opacity and stroke-dashoffset animate.
 */
export class Timeline {
  private readonly rules: string[] = [];
  private readonly names = new Set<string>();

  constructor(
    /** Loop length in seconds. */
    readonly T: number,
  ) {}

  private pc(s: number) {
    return `${((Math.max(0, Math.min(this.T, s)) / this.T) * 100).toFixed(2)}%`;
  }

  private add(name: string, body: string) {
    if (!this.names.has(name)) {
      this.names.add(name);
      this.rules.push(`@keyframes ${name}{${body}}`);
    }
    return name;
  }

  /** Visible between `a` and `b` seconds; enters from `from`. */
  win(name: string, a: number, b: number, from = "translateY(8px)", fade = 0.35) {
    const { T } = this;
    const end = Math.min(T, b + fade);
    if (b >= T) return this.add(name, `0%,${this.pc(a)}{opacity:0;transform:${from}}${this.pc(a + fade)},100%{opacity:1;transform:none}`);
    return this.add(
      name,
      `0%,${this.pc(a)}{opacity:0;transform:${from}}${this.pc(a + fade)},${this.pc(b)}{opacity:1;transform:none}${this.pc(end)},100%{opacity:0;transform:${end >= T ? "none" : from}}`,
    );
  }

  /** Grows along an axis (bars, text lines) at `a`, holds until `b`. */
  grow(name: string, a: number, b: number, axis: "X" | "Y" = "X", dur = 0.7) {
    if (b >= this.T) return this.add(name, `0%,${this.pc(a)}{transform:scale${axis}(0)}${this.pc(a + dur)},100%{transform:scale${axis}(1)}`);
    return this.add(
      name,
      `0%,${this.pc(a)}{transform:scale${axis}(0);opacity:1}${this.pc(a + dur)},${this.pc(b)}{transform:scale${axis}(1);opacity:1}${this.pc(b + 0.3)},100%{transform:scale${axis}(1);opacity:0}`,
    );
  }

  /** Draws a stroked path between `a` and `a + dur`, holds until `b`. */
  draw(name: string, a: number, b: number, len: number, dur = 0.8) {
    return this.add(
      name,
      `0%,${this.pc(a)}{stroke-dashoffset:${len};opacity:1}${this.pc(a + dur)},${this.pc(b)}{stroke-dashoffset:0;opacity:1}${this.pc(b + 0.3)},100%{stroke-dashoffset:0;opacity:0}`,
    );
  }

  /** Free keyframes from [seconds, declarations] pairs. */
  path(name: string, frames: [number, string][]) {
    return this.add(name, frames.map(([t, c]) => `${this.pc(t)}{${c}}`).join(""));
  }

  /** Props for an animated element: `<g {...tl.a(name)}>`. Extra style (fill, stroke…) merges in. */
  a(name: string, extraClass = "", style?: CSSProperties) {
    return {
      className: extraClass ? `mga ${extraClass}` : "mga",
      style: { "--T": `${this.T}s`, animationName: name, ...style } as CSSProperties,
    };
  }

  get css() {
    return this.rules.join("\n");
  }
}
