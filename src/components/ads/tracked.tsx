"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { trackAd, type AdEvent } from "@/lib/ad-track";

/**
 * Wraps one ad. Counts an impression when at least half of it has been on screen for a second
 * (the industry's viewable standard), once per creative, and a click on any button or link
 * inside it except ones marked data-ad-ignore (the "Sponsored" label, Watch).
 */
export function Tracked({ placement, format, creative, className, children }: Omit<AdEvent, "kind"> & { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let t: number | null = null;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && document.visibilityState === "visible") {
          t ??= window.setTimeout(() => {
            trackAd({ kind: "impression", placement, format, creative });
            io.disconnect();
          }, 1000);
        } else if (t) {
          window.clearTimeout(t);
          t = null;
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (t) window.clearTimeout(t);
    };
  }, [placement, format, creative]);

  return (
    <div
      ref={ref}
      className={className}
      onClickCapture={(e) => {
        const hit = (e.target as HTMLElement).closest("button, a");
        if (hit && !hit.hasAttribute("data-ad-ignore")) trackAd({ kind: "click", placement, format, creative });
      }}
    >
      {children}
    </div>
  );
}
