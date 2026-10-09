"use client";

import { useEffect, useRef, useState } from "react";
import { sizeOf, type NetworkSize } from "@/lib/ad-network";
import { markNetworkEmpty, useNetwork } from "@/lib/ads-context";
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
export function NetworkUnit({ size, network, placement }: { size: NetworkSize; network: string; placement: string }) {
  const { w, h } = sizeOf(size);
  const frame = useRef<HTMLIFrameElement>(null);
  const [filled, setFilled] = useState(false);
  const net = useNetwork();
  const host = net?.host ?? "";
  // Iframe-only banners load straight from the network's own site.
  const direct = net?.direct?.[size] ?? "";
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const m = (e.data as { wanllyAd?: string })?.wanllyAd;
      if (m === "filled") setFilled(true);
      if (m === "empty") markNetworkEmpty(size);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [size]);
  const iframe = (
    <iframe
      ref={frame}
      title="Advertisement"
      src={direct || `${host}/api/ads/unit?size=${size}`}
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
    <Tracked placement={placement} format="display" creative={`network:${network || "network"}`} className="shrink-0" paused={!filled}>
      {iframe}
    </Tracked>
  );
}
