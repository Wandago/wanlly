"use client";

import { creativeOf, useSponsors } from "@/lib/ads-context";
import type { NetworkSize } from "@/lib/ad-network";
import { RAIL_SPONSORS } from "@/lib/catalog";
import { SponsorLine, SponsorStack } from "./ad-slot";
import { DisplaySlot } from "./display-slot";
import { Tracked } from "./tracked";

/**
 * Any spare space on a page: the ad network's banner (or a booked campaign) in the largest size
 * that fits, and a sponsor card when neither has one, so the space is never left empty.
 */
export function SpaceAd({
  placement,
  sizes = ["728x90", "468x60", "320x100", "320x50"],
  className = "",
  narrow = false,
}: {
  placement: string;
  sizes?: NetworkSize[];
  className?: string;
  /** A narrow column: the sponsor card is stacked instead of a single line. */
  narrow?: boolean;
}) {
  const sponsor = useSponsors(placement, RAIL_SPONSORS)[0];
  return (
    <div className={className}>
      <DisplaySlot
        placement={placement}
        sizes={sizes}
        className="flex flex-col items-center gap-1"
        fallback={
          sponsor && (
            <Tracked key={creativeOf(sponsor)} placement={placement} format="native" creative={creativeOf(sponsor)}>
              {narrow ? <SponsorStack sponsor={sponsor} /> : <SponsorLine sponsor={sponsor} format="native" earned={false} />}
            </Tracked>
          )
        }
      />
    </div>
  );
}
