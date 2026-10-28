"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/hooks/use-client-values";
import { browserTimeZone } from "@/lib/time";

/** Fired by RegisterPanel once a registration succeeds. */
export const REGISTERED_EVENT = "dg:registered";

/**
 * Phones and tablets (prototype mobile-cta): the form sits below the details, so keep a bar with the date,
 * "Free" and Register at the bottom until the form is on screen.
 */
export function MobileRegisterBar({ targetId, live, startsAt, timeZone }: { targetId: string; live: boolean; startsAt?: string; timeZone?: string }) {
  const [formBelow, setFormBelow] = useState(false);
  // Once someone starts filling in the form (or has registered), the bar is done.
  // This also keeps it from popping up when the phone keyboard shrinks the viewport.
  const [engaged, setEngaged] = useState(false);
  const mounted = useMounted();

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setFormBelow(!!entry && !entry.isIntersecting && entry.boundingClientRect.top > 0),
      { rootMargin: "0px 0px -15% 0px" },
    );
    observer.observe(target);
    const engage = () => setEngaged(true);
    target.addEventListener("focusin", engage);
    window.addEventListener(REGISTERED_EVENT, engage);
    return () => {
      observer.disconnect();
      target.removeEventListener("focusin", engage);
      window.removeEventListener(REGISTERED_EVENT, engage);
    };
  }, [targetId]);

  function scrollToForm() {
    const target = document.getElementById(targetId);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Focus after the scroll settles so the keyboard doesn't jump the page.
    window.setTimeout(() => target?.querySelector<HTMLInputElement>("input:not([readonly])")?.focus({ preventScroll: true }), 450);
  }

  const when =
    startsAt && mounted
      ? new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: browserTimeZone() || timeZone }).format(new Date(startsAt))
      : null;

  return (
    <AnimatePresence>
      {formBelow && !engaged && (
        <motion.div
          initial={{ y: "110%" }}
          animate={{ y: 0 }}
          exit={{ y: "110%" }}
          transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
          className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-elevated lg:hidden"
        >
          <div className="min-w-0">
            {live ? <p className="text-xs font-semibold text-live">Live now</p> : when && <p className="truncate text-xs text-muted-foreground">{when}</p>}
            <b className="text-sm">Free</b>
          </div>
          <Button cta={false} onClick={scrollToForm} className={live ? "bg-live text-white hover:bg-live/90" : undefined}>
            {live ? "Join free" : "Register now"}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
