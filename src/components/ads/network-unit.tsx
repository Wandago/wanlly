"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { frameUrl, sizeOf, type NetworkSize } from "@/lib/ad-network";
import { markNetworkEmpty, useNetwork } from "@/lib/ads-context";
import { AdsenseUnit } from "./adsense-unit";
import { Tracked } from "./tracked";

/**
 * Banners served from Wanlly itself run with no origin at all. Banners from a separate banner
 * host may keep their own origin there (so the network's script can use storage): it's another
 * site, so it still can't read or change anything of Wanlly's.
 */
export const frameSandbox = (host: string) =>
  `allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms${host && typeof location !== "undefined" && host !== location.origin ? " allow-same-origin" : ""}`;

/** A network's own page in a frame: its own origin, so it keeps its storage but can't touch Wanlly. */
export const DIRECT_SANDBOX = "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms";

/**
 * One banner from the ad network, in a sandboxed frame of exactly its size. The frame's page
 * comes from /api/ads/unit with its own sandbox policy, so the network's script can open a new
 * tab when clicked but can't touch Wanlly. The page says whether an ad appeared: until then the
 * frame stays invisible, and if none does, the slot goes back to sponsors.
 */
export function NetworkUnit({ size, network, placement, onFilled }: { size: NetworkSize; network: string; placement: string; onFilled?: (filled: boolean) => void }) {
  const { w, h } = sizeOf(size);
  const frame = useRef<HTMLIFrameElement>(null);
  const [filled, setFilled] = useState(false);
  const shown = useRef(false);
  const net = useNetwork();
  const host = net?.host ?? "";
  // Iframe-only banners load straight from the network's own site.
  const direct = net?.direct?.[size] ?? "";
  // Script banners: from the banner host when there is one (its own origin), else from Wanlly.
  const code = net?.codes?.[size];
  // Whichever network is first in line for this size right now (see useNetwork).
  const name = net?.by[size] ?? network;
  const src = direct || (host && code ? frameUrl(host, code) : `/api/ads/unit?size=${size}&net=${encodeURIComponent(name)}`);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const m = (e.data as { wanllyAd?: string })?.wanllyAd;
      if (m === "filled") {
        shown.current = true;
        setFilled(true);
      }
      if (m === "empty") markNetworkEmpty(name, size);
      // A script that was blocked (usually an ad blocker) or broke: unless an ad still shows
      // within a moment (some throw harmless errors), go to the next network.
      if (m === "blocked" || m === "error") window.setTimeout(() => shown.current || markNetworkEmpty(name, size), 2500);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [size, name]);
  // A frame that never reports back (its host is down, or a script was blocked) counts as empty
  // after a while, so the slot goes back to sponsors instead of staying blank.
  useEffect(() => {
    if (filled || direct) return;
    const t = window.setTimeout(() => markNetworkEmpty(name, size), 9_000);
    return () => window.clearTimeout(t);
  }, [filled, direct, name, size, src]);
  useEffect(() => {
    onFilled?.(filled);
  }, [filled, onFilled]);
  // Google AdSense: drawn on the page itself, as AdSense requires.
  const google = net?.google?.[size];
  const onGoogle = useCallback((ok: boolean) => (ok ? setFilled(true) : markNetworkEmpty(name, size)), [name, size]);
  if (google)
    return (
      <Tracked placement={placement} format="display" creative={`network:${name || "google"}`} className="shrink-0" paused={!filled}>
        {/* Invisible (but laid out, so Google can fill it) until AdSense says it has an ad. */}
        <div className={`transition-opacity ${filled ? "opacity-100" : "opacity-0"}`}>
          <AdsenseUnit client={google.client} slot={google.slot} w={w} h={h} onState={onGoogle} />
        </div>
      </Tracked>
    );
  const iframe = (
    <iframe
      key={src}
      ref={frame}
      title="Advertisement"
      src={src}
      width={w}
      height={h}
      sandbox={direct ? DIRECT_SANDBOX : frameSandbox(host)}
      onLoad={direct ? () => setFilled(true) : undefined}
      className={`block border-0 transition-opacity ${filled ? "opacity-100" : "opacity-0"}`}
      style={{ width: w, height: h, colorScheme: "normal" }}
    />
  );
  // Only a banner that actually showed counts as a view.
  return (
    <Tracked placement={placement} format="display" creative={`network:${name || "network"}`} className="shrink-0" paused={!filled}>
      {iframe}
    </Tracked>
  );
}

/**
 * A network banner that waits behind `fallback`: the fallback shows until the network's ad has
 * actually appeared, so a slow or empty network never leaves a blank box. The banner is laid out
 * (invisibly) the whole time, as networks need it on the page to fill it.
 */
export function NetworkOrFallback({ fallback, children }: { fallback: ReactNode; children: (onFilled: (filled: boolean) => void) => ReactNode }) {
  const [filled, setFilled] = useState(false);
  if (!fallback) return <>{children(setFilled)}</>;
  return (
    <div className="relative w-full">
      {!filled && fallback}
      <div className={filled ? "flex w-full flex-col items-center" : "pointer-events-none absolute top-0 left-0 opacity-0"} aria-hidden={!filled}>
        {children(setFilled)}
      </div>
    </div>
  );
}
