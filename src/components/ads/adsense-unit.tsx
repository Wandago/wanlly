"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const loaded = new Set<string>();

/** Loads AdSense's script once for this publisher. */
function loadAdsense(client: string) {
  if (loaded.has(client) || typeof document === "undefined") return;
  loaded.add(client);
  const s = document.createElement("script");
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(s);
}

/**
 * One AdSense unit, drawn right on the page as AdSense requires (never in a frame), at a fixed
 * size. AdSense marks the unit filled or unfilled; that's passed on so an empty one gives its
 * space back to sponsors.
 */
export function AdsenseUnit({ client, slot, w, h, onState }: { client: string; slot: string; w: number; h: number; onState?: (filled: boolean) => void }) {
  const ins = useRef<HTMLModElement>(null);
  const pushed = useRef(false);
  useEffect(() => {
    const el = ins.current;
    if (!el || pushed.current) return;
    pushed.current = true;
    loadAdsense(client);
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      onState?.(false);
    }
    const report = () => {
      const s = el.getAttribute("data-ad-status");
      if (s === "filled") onState?.(true);
      if (s === "unfilled") onState?.(false);
    };
    const mo = new MutationObserver(report);
    mo.observe(el, { attributes: true, attributeFilter: ["data-ad-status"] });
    return () => mo.disconnect();
  }, [client, onState]);
  return <ins ref={ins} className="adsbygoogle" style={{ display: "inline-block", width: w, height: h }} data-ad-client={client} data-ad-slot={slot} />;
}
