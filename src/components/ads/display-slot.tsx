"use client";

import { useEffect, type ReactNode } from "react";
import { sizeOf, type NetworkSize } from "@/lib/ad-network";
import { creativeOf, openSponsor, useNetwork, useSponsors } from "@/lib/ads-context";
import { useWorkspace } from "@/lib/workspace-store";
import { useWidth } from "./creatives";
import { NetworkUnit } from "./network-unit";
import { Tracked } from "./tracked";

/*
 * One banner space. What fills it, in order: a sold campaign booked for this place that has a
 * banner in a size that fits; otherwise the ad network's banner in a size that fits; otherwise
 * `fallback` (or nothing). Sizes are tried in the order given, largest first, against the width
 * available, so the same slot serves 728×90 on a laptop and 320×50 on a phone.
 */
export function DisplaySlot({
  placement,
  sizes,
  fallback = null,
  label = "Sponsored",
  className = "",
  onBanner,
}: {
  placement: string;
  sizes: NetworkSize[];
  fallback?: ReactNode;
  /** Shown above a banner; empty for none. */
  label?: string;
  /** Padding and such, applied only when a banner is shown (the fallback brings its own). */
  className?: string;
  /** Told whether a banner (rather than the fallback) is showing. */
  onBanner?: (shown: boolean) => void;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { dispatch } = useWorkspace();
  const network = useNetwork();
  const booked = useSponsors(placement, []);
  const fits = (s: NetworkSize) => width > 0 && sizeOf(s).w <= width;
  const campaign = booked.map((sp) => ({ sp, size: sizes.find((s) => fits(s) && sp.banners?.includes(s)) })).find((x) => x.size);
  const netSize = network ? sizes.find((s) => fits(s) && network.sizes.includes(s)) : undefined;

  let body: ReactNode = fallback;
  if (campaign?.size) {
    const { sp, size } = campaign;
    const { w, h } = sizeOf(size);
    body = (
      <Tracked placement={placement} format="display" creative={creativeOf(sp)} className="shrink-0">
        <button type="button" aria-label={`${sp.name}: ${sp.cta}`} onClick={() => openSponsor(sp, placement) || dispatch({ type: "toast", text: `Opens ${sp.name} in a new tab` })} className="block overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/ads/banner/${sp.campaignId}/${size}`} alt={`${sp.name}: ${sp.headline}`} width={w} height={h} style={{ width: w, height: h }} className="block" />
        </button>
      </Tracked>
    );
  } else if (network && netSize) {
    body = <NetworkUnit size={netSize} network={network.name} placement={placement} />;
  }
  const isBanner = !!campaign?.size || !!(network && netSize);
  useEffect(() => {
    onBanner?.(isBanner);
  }, [isBanner, onBanner]);
  return (
    <div ref={ref} className={`flex w-full flex-col items-center gap-1.5 ${isBanner ? className : ""}`}>
      {isBanner && label && <span className="self-start text-[11px] tracking-[0.07em] text-faint uppercase">{label}</span>}
      {body}
    </div>
  );
}
