"use client";

import { SpaceAd } from "./space-ad";

/**
 * A banner under the composer on an empty chat, phones included: a sold campaign's banner, else
 * the ad network's (728×90 down to 320×50, whatever fits), else a sponsor card.
 */
export function HomeBanner() {
  return <SpaceAd placement="home_banner" />;
}
