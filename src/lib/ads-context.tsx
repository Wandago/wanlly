"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Sponsor } from "./catalog";

/*
 * Directly sold ads, fetched once per visit from /api/ads. Each slot shows the campaigns booked
 * for it and falls back to Wanlly's own house sponsors when none are running.
 */

type Served = Sponsor & { placements: string[] };
const AdsContext = createContext<Served[]>([]);

export function AdsProvider({ children }: { children: ReactNode }) {
  const [ads, setAds] = useState<Served[]>([]);
  useEffect(() => {
    let live = true;
    fetch("/api/ads")
      .then((r) => (r.ok ? r.json() : { ads: [] }))
      .then((b) => live && Array.isArray(b.ads) && setAds(b.ads))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return <AdsContext.Provider value={ads}>{children}</AdsContext.Provider>;
}

/** The sponsors for one placement: booked campaigns first, otherwise the fallback list. */
export function useSponsors(placement: string, fallback: Sponsor[]): Sponsor[] {
  const ads = useContext(AdsContext);
  return useMemo(() => {
    const booked = ads.filter((a) => a.placements.includes(placement));
    return booked.length ? booked : fallback;
  }, [ads, placement, fallback]);
}

/** How a sponsor is named in ad events: campaigns by id, house sponsors by name. */
export const creativeOf = (s: Sponsor) => (s.campaignId ? `campaign:${s.campaignId}` : s.name);

/** Opens a sold ad's link in a new tab, tagged so the advertiser can see it came from Wanlly. */
export function openSponsor(s: Sponsor, placement: string): boolean {
  if (!s.url) return false;
  try {
    const u = new URL(s.url);
    if (!u.searchParams.has("utm_source")) {
      u.searchParams.set("utm_source", "wanlly");
      u.searchParams.set("utm_medium", placement);
      if (s.campaignId) u.searchParams.set("utm_campaign", String(s.campaignId));
    }
    window.open(u.toString(), "_blank", "noopener,noreferrer");
    return true;
  } catch {
    return false;
  }
}
