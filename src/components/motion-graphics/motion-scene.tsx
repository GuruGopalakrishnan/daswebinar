"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

let visibilityListeners = 0;
function onVisibility() {
  document.documentElement.classList.toggle("mg-hidden", document.hidden);
}

/**
 * Frame for a motion graphic. Scenes start paused and run only while at least partly on screen
 * (IntersectionObserver toggles `mg-run` on the element, no re-render) and while the tab is visible
 * (`mg-hidden` on <html> pauses all). Reduced motion is handled in CSS: every scene shows a still frame.
 */
export function MotionScene({
  as: Tag = "figure",
  className,
  ...props
}: { as?: "figure" | "div" } & ComponentPropsWithoutRef<"figure">) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      el.classList.add("mg-run");
      return;
    }
    const io = new IntersectionObserver(([entry]) => el.classList.toggle("mg-run", entry.isIntersecting), { rootMargin: "40px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (visibilityListeners++ === 0) document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (--visibilityListeners === 0) document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <Tag ref={ref as React.Ref<HTMLElement & HTMLDivElement>} className={cn("mg", className)} {...props} />;
}
