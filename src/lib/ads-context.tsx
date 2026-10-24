"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { seenToday } from "./ad-track";
import type { NetworkSize } from "./ad-network";
import { useWorkspace } from "./workspace-store";
import { matchScore } from "./affiliates";
import type { Sponsor } from "./catalog";
import { BUILTIN_VIDEO, type HouseVideo } from "./ads";

/*
 * Directly sold ads, fetched once per visit from /api/ads. Each slot shows the campaigns booked
 * for it and falls back to Wanlly's own house sponsors when none are running.
 */

type Served = Sponsor & { placements: string[] };
type Native = { code: string; height: number };
const STAFF = new Set(["owner", "admin", "support", "moderator", "analyst"]);
/** One ad network as /api/ads sends it; the list comes best-paying first. */
type Google = { client: string; slot: string };
type NetInfo = { name: string; audience: "staff" | "everyone"; sizes: NetworkSize[]; direct: Record<string, string>; codes: Record<string, string>; google?: Record<string, Google>; native?: Native };
const AdsContext = createContext<{ ads: Served[]; seen: number; networks: NetInfo[]; host: string; house: Sponsor[]; videos: HouseVideo[] }>({ ads: [], seen: 0, networks: [], host: "", house: [], videos: [] });

export function AdsProvider({ children }: { children: ReactNode }) {
  const [ads, setAds] = useState<Served[]>([]);
  const [house, setHouse] = useState<Sponsor[]>([]);
  const [videos, setVideos] = useState<HouseVideo[]>([]);
  const [nets, setNets] = useState<{ list: NetInfo[]; host: string }>({ list: [], host: "" });
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
        if (Array.isArray(b.videos)) setVideos(b.videos);
        if (Array.isArray(b.networks) && b.networks.length) setNets({ list: b.networks, host: b.host ?? "" });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  // "staff" networks are being checked by the team; everyone else keeps seeing sponsors.
  const staff = STAFF.has(me?.role ?? "");
  const networks = useMemo(() => nets.list.filter((n) => n.audience === "everyone" || staff), [nets, staff]);
  const value = useMemo(() => ({ ads, seen, networks, host: nets.host, house, videos }), [ads, seen, networks, nets.host, house, videos]);
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

/**
 * One of Wanlly's own MP4 ads for a rewarded spot (Wanlly's promo film when none is on). They take turns
 * (the next one each time, remembered for the visit). Chosen once, when the spot first renders,
 * so a spot never switches between a video and the plain timer part-way.
 */
export function useHouseVideo(): HouseVideo {
  const { videos } = useContext(AdsContext);
  const [pick] = useState<HouseVideo>(() => {
    if (!videos.length) return BUILTIN_VIDEO;
    let n = 0;
    try {
      n = Number(sessionStorage.getItem("wanlly-video-turn")) || 0;
      sessionStorage.setItem("wanlly-video-turn", String(n + 1));
    } catch {}
    // Brands take turns (TumaCV, Wanlly Sign, Wanlly…), then that brand's videos take turns, so a
    // brand with more videos doesn't get more plays.
    const brands = [...new Set(videos.map((v) => v.brand))];
    const own = videos.filter((v) => v.brand === brands[n % brands.length]);
    return own[Math.floor(n / brands.length) % own.length];
  });
  return pick;
}

/** Conversations about these get no suggested ad (health, mental health, politics, money trouble). */
const SENSITIVE = /\b(suicid\w*|self[- ]harm|depress\w*|anxiety|therap\w*|diagnos\w*|symptom\w*|medic\w*|pregnan\w*|hiv|cancer|abortion|politic\w*|election\w*|vote|voting|religio\w*|abuse\w*|debt|loan shark|gambl\w*|betting)\b/i;

/**
 * The sponsored suggestion for an AI answer: a sold "suggested" campaign whose
 * topics match what was asked (best match first), else one of Wanlly's own offers that matches.
 * Nothing when nothing matches, the topic is sensitive, or the person hid that advertiser.
 */
export function useSuggested(context: string, hidden: string[]): Sponsor | null {
  const { ads, house, seen } = useContext(AdsContext);
  return useMemo(() => {
    void seen;
    if (!context.trim() || SENSITIVE.test(context)) return null;
    const pick = (list: Sponsor[]) =>
      list
        .filter((a) => !hidden.includes(a.name) && !(a.cap && seenToday(creativeOf(a)) >= a.cap))
        .map((a) => ({ a, score: matchScore(a.keywords, context) }))
        .filter((x) => x.score >= 1)
        .sort((x, y) => y.score - x.score)[0]?.a ?? null;
    return pick(ads.filter((a) => a.placements.includes("suggested"))) ?? pick(house.filter((h) => !h.places || h.places.includes("suggested")));
  }, [ads, house, seen, context, hidden]);
}

/* Network and size pairs that just answered with no ad. They're skipped for 10 minutes, so the
   slot goes to the next network (or a sponsor) instead of an empty box, then tried again. Kept for
   the browser tab (sessionStorage), so moving between pages doesn't wait on the same empty network. */
const EMPTY_FOR = 10 * 60_000;
const EMPTY_KEY = "wanlly-empty-networks";
const emptySizes = new Set<string>();
let emptyVersion = 0;
const emptyListeners = new Set<() => void>();
const changed = () => {
  emptyVersion++;
  emptyListeners.forEach((fn) => fn());
};
function forget(key: string, after: number) {
  window.setTimeout(() => {
    emptySizes.delete(key);
    save();
    changed();
  }, after);
}
const until = new Map<string, number>();
function save() {
  try {
    sessionStorage.setItem(EMPTY_KEY, JSON.stringify(Object.fromEntries([...until].filter(([k]) => emptySizes.has(k)))));
  } catch {}
}
if (typeof window !== "undefined") {
  try {
    const saved = JSON.parse(sessionStorage.getItem(EMPTY_KEY) ?? "{}") as Record<string, number>;
    for (const [key, t] of Object.entries(saved))
      if (typeof t === "number" && t > Date.now()) {
        emptySizes.add(key);
        until.set(key, t);
        forget(key, t - Date.now());
      }
  } catch {}
}
export function markNetworkEmpty(network: string, size: string) {
  const key = `${network}:${size}`;
  if (emptySizes.has(key)) return;
  emptySizes.add(key);
  until.set(key, Date.now() + EMPTY_FOR);
  save();
  changed();
  forget(key, EMPTY_FOR);
}
const subscribeEmpty = (fn: () => void) => {
  emptyListeners.add(fn);
  return () => emptyListeners.delete(fn);
};

/**
 * The network banners this person may see right now, as one view across every network: for each
 * size, the best-paying network that has it and didn't just come back empty (`by` names it).
 * Null when no network has anything to show.
 */
export function useNetwork() {
  const { networks, host } = useContext(AdsContext);
  const version = useSyncExternalStore(subscribeEmpty, () => emptyVersion, () => 0);
  return useMemo(() => {
    void version;
    const by: Record<string, string> = {};
    const direct: Record<string, string> = {};
    const codes: Record<string, string> = {};
    const google: Record<string, Google> = {};
    for (const n of networks)
      for (const size of n.sizes) {
        if (by[size] || emptySizes.has(`${n.name}:${size}`)) continue;
        by[size] = n.name;
        if (n.direct[size]) direct[size] = n.direct[size];
        if (n.codes[size]) codes[size] = n.codes[size];
        if (n.google?.[size]) google[size] = n.google[size];
      }
    const nativeFrom = networks.find((n) => n.native && !emptySizes.has(`${n.name}:native`));
    const native = nativeFrom?.native ? { ...nativeFrom.native, name: nativeFrom.name } : undefined;
    const sizes = Object.keys(by) as NetworkSize[];
    if (!sizes.length && !native) return null;
    return { name: networks[0]?.name ?? "", sizes, by, host, direct, codes, google, native };
  }, [networks, host, version]);
}

/** Sponsor offers that pay credits once the partner confirms a signup (Admin → Affiliates). */
export function useOffers(): Sponsor[] {
  const { house } = useContext(AdsContext);
  return useMemo(() => house.filter((h) => h.offerCredits && h.affiliateId), [house]);
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
