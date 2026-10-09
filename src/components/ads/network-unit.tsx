"use client";

import { useEffect, useRef, useState } from "react";
import { sizeOf, type NetworkSize } from "@/lib/ad-network";
import { markNetworkEmpty } from "@/lib/ads-context";
import { Tracked } from "./tracked";

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
      src={`/api/ads/unit?size=${size}`}
      width={w}
      height={h}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
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
