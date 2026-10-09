"use client";

import type { NetworkSize } from "@/lib/ad-network";
import { useNetwork } from "@/lib/ads-context";
import { useWidth } from "./creatives";
import { NetworkUnit } from "./network-unit";

const FIT: [NetworkSize, number][] = [
  ["728x90", 728],
  ["468x60", 468],
];

/**
 * A network banner under the composer on an empty chat, from tablet width up (phones already
 * have the bottom bar). The widest size the network has that fits; nothing without a network.
 */
export function HomeBanner() {
  const network = useNetwork();
  const [ref, width] = useWidth<HTMLDivElement>();
  const size = network && width ? FIT.find(([s, w]) => network.sizes.includes(s) && w <= width)?.[0] : undefined;
  return (
    <div ref={ref} className="flex w-full justify-center max-md:hidden">
      {network && size && <NetworkUnit size={size} network={network.name} placement="home_banner" />}
    </div>
  );
}
