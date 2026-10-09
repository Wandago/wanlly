"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { seenToday } from "./ad-track";
import type { NetworkSize } from "./ad-network";
import { useWorkspace } from "./workspace-store";
import { matchScore } from "./affiliates";
import type { Sponsor } from "./catalog";

/*
 * Directly sold ads, fetched once per visit from /api/ads. Each slot shows the campaigns booked
 * for it and falls back to Wanlly's own house sponsors when none are running.
 */

type Served = Sponsor & { placements: string[] };
type Native = { code: string; height: number };
type Network = { name: string; audience: "staff" | "everyone"; sizes: NetworkSize[]; host?: string; direct?: Record<string, string>; codes?: Record<string, string>; native?: Native } | null;
const STAFF = new Set(["owner", "admin", "support", "moderator", "analyst"]);
type NetInfo = { name: string; sizes: NetworkSize[]; host: string; direct: Record<string, string>; codes: Record<string, string>; native?: Native };
const AdsContext = createContext<{ ads: Served[]; seen: number; network: NetInfo | null; house: Sponsor[] }>({ ads: [], seen: 0, network: null, house: [] });

export function AdsProvider({ children }: { children: ReactNode }) {
  const [ads, setAds] = useState<Served[]>([]);
  const [house, setHouse] = useState<Sponsor[]>([]);
  const [net, setNet] = useState<Network>(null);
  const { me } = useWorkspace();
  // Bumped after each counted view, so campaigns that reach their daily cap drop out.
  const [seen, setSeen] = useState(0);
  useEffect(() => {
    const bump = () => setSeen((n) => n + 1);
    window.addEventListener("wanlly-ad-seen", bump);
    return () => window.removeEventListener("wanlly-ad-seen", bump);
  }, []);
  useEffect(() => {
    let live = true;
    fetch("/api/ads")
      .then((r) => (r.ok ? r.json() : { ads: [] }))
      .then((b) => {
        if (!live) return;
        if (Array.isArray(b.ads)) setAds(b.ads);
        if (Array.isArray(b.house)) setHouse(b.house);
        if (b.network?.sizes?.length) setNet(b.network);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  // "staff" networks are being checked by the team; everyone else keeps seeing sponsors.
  const netKey = net && (net.audience === "everyone" || STAFF.has(me?.role ?? "")) ? JSON.stringify({ name: net.name, sizes: net.sizes, host: net.host ?? "", direct: net.direct ?? {}, codes: net.codes ?? {}, native: net.native }) : "";
  const value = useMemo(() => ({ ads, seen, network: netKey ? (JSON.parse(netKey) as NetInfo) : null, house }), [ads, seen, netKey, house]);
  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}

/**
 * The sponsors for one placement: booked campaigns first, otherwise the fallback list. A campaign
 * this person has already seen as often as its daily cap allows is skipped until tomorrow.
 */
export function useSponsors(placement: string, fallback: Sponsor[], context = ""): Sponsor[] {
  const { ads, seen, house } = useContext(AdsContext);
  const { memory, settings } = useWorkspace();
  // General interests only count when the person allows personalised ads.
  const interests = settings?.personalisedAds === false ? "" : (memory?.interests?.join(" ") ?? "");
  return useMemo(() => {
    void seen;
    const booked = ads.filter((a) => a.placements.includes(placement) && !(a.cap && seenToday(creativeOf(a)) >= a.cap));
    if (booked.length) return booked;
    // Wanlly's affiliate offers next: the best match for what's being worked on comes first
    // (what was just asked counts double, what the person is generally into once).
    const offers = house.filter((h) => !h.places || h.places.includes(placement));
    if (offers.length) {
      const score = (h: Sponsor) => 2 * matchScore(h.keywords, context) + matchScore(h.keywords, interests);
      return [...offers].sort((a, b) => score(b) - score(a));
    }
    return fallback;
  }, [ads, seen, house, placement, fallback, context, interests]);
}

/* Sizes the network just answered with no ad. They're skipped for 10 minutes so the slot shows
   a sponsor instead of an empty box, then tried again. */
const EMPTY_FOR = 10 * 60_000;
const emptySizes = new Set<string>();
let emptyVersion = 0;
const emptyListeners = new Set<() => void>();
const changed = () => {
  emptyVersion++;
  emptyListeners.forEach((fn) => fn());
};
export function markNetworkEmpty(size: string) {
  if (emptySizes.has(size)) return;
  emptySizes.add(size);
  changed();
  window.setTimeout(() => {
    emptySizes.delete(size);
    changed();
  }, EMPTY_FOR);
}
const subscribeEmpty = (fn: () => void) => {
  emptyListeners.add(fn);
  return () => emptyListeners.delete(fn);
};

/** The network banner sizes this person may see right now; null when there's no network. */
export function useNetwork() {
  const network = useContext(AdsContext).network;
  const version = useSyncExternalStore(subscribeEmpty, () => emptyVersion, () => 0);
  return useMemo(() => {
    void version;
    if (!network) return null;
    const sizes = network.sizes.filter((s) => !emptySizes.has(s));
    const native = emptySizes.has("native") ? undefined : network.native;
    return sizes.length || native ? { ...network, sizes, native } : null;
  }, [network, version]);
}

/** A counter that ticks every `ms` while the page is visible, for alternating ads in a slot. */
export function useTick(ms: number, offset = 0) {
  const [i, setI] = useState(offset);
  useEffect(() => {
    const iv = window.setInterval(() => document.visibilityState === "visible" && setI((n) => n + 1), ms);
    return () => window.clearInterval(iv);
  }, [ms]);
  return i;
}

/** How a sponsor is named in ad events: campaigns by id, house sponsors by name. */
export const creativeOf = (s: Sponsor) => (s.campaignId ? `campaign:${s.campaignId}` : s.affiliateId ? `affiliate:${s.affiliateId}` : s.name);

/** Opens a sold ad's link in a new tab, tagged so the advertiser can see it came from Wanlly. */
export function openSponsor(s: Sponsor, placement: string): boolean {
  if (!s.url) return false;
  try {
    const u = new URL(s.url);
    if (!u.searchParams.has("utm_source")) {
      u.searchParams.set("utm_source", "wanlly");
      u.searchParams.set("utm_medium", placement);
      if (s.campaignId) u.searchParams.set("utm_campaign", String(s.campaignId));
      else if (s.affiliateId) u.searchParams.set("utm_campaign", s.affiliateId);
    }
    window.open(u.toString(), "_blank", "noopener,noreferrer");
    return true;
  } catch {
    return false;
  }
}
