"use client";

import { sizeOf, type NetworkSize } from "@/lib/ad-network";
import { Tracked } from "./tracked";

/**
 * One banner from the ad network, in a sandboxed frame of exactly its size. The frame's page
 * comes from /api/ads/unit with its own sandbox policy, so the network's script can open a new
 * tab when clicked but can't touch Wanlly.
 */
export function NetworkUnit({ size, network, placement }: { size: NetworkSize; network: string; placement: string }) {
  const { w, h } = sizeOf(size);
  return (
    <Tracked placement={placement} format="display" creative={`network:${network || "network"}`} className="shrink-0">
      <iframe
        title="Advertisement"
        src={`/api/ads/unit?size=${size}`}
        width={w}
        height={h}
        loading="lazy"
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
        className="block border-0"
        style={{ width: w, height: h }}
      />
    </Tracked>
  );
}
