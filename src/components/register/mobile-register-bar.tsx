"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Fired by RegisterPanel once a registration succeeds. */
export const REGISTERED_EVENT = "onstage:registered";

/**
 * Phones and tablets: the form sits below the webinar details, so keep a
 * "Save my seat" bar at the bottom until the form is on screen.
 */
export function MobileRegisterBar({ targetId, live }: { targetId: string; live: boolean }) {
  const [formBelow, setFormBelow] = useState(false);
  // Once someone starts filling in the form (or has registered), the bar is done.
  // This also keeps it from popping up when the phone keyboard shrinks the viewport.
  const [engaged, setEngaged] = useState(false);

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

  return (
    <AnimatePresence>
      {formBelow && !engaged && (
        <motion.div
          initial={{ y: "110%" }}
          animate={{ y: 0 }}
          exit={{ y: "110%" }}
          transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
          className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden"
        >
          <Button
            size="lg"
            onClick={scrollToForm}
            className={live ? "w-full bg-live text-white hover:bg-live/90" : "w-full"}
          >
            {live ? "Live now · Join free" : "Save my seat · Free"} <ArrowDown />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
