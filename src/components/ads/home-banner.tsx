"use client";

import { DisplaySlot } from "./display-slot";

/**
 * A banner under the composer on an empty chat, from tablet width up (phones already have the
 * bottom bar): a sold campaign's banner, else the ad network's, at 728×90 or 468×60.
 */
export function HomeBanner() {
  return (
    <div className="max-md:hidden">
      <DisplaySlot placement="home_banner" sizes={["728x90", "468x60"]} label="" />
    </div>
  );
}
