import type { Sponsor } from "./catalog";

/** Video spots arrive in one of three shapes. Each gets a height cap so it never swamps the page. */
export type VideoAspect = "16:9" | "9:16" | "1:1";

export const VIDEO_ASPECTS: Record<VideoAspect, { ratio: string; maxHeight: number; label: string }> = {
  "16:9": { ratio: "16 / 9", maxHeight: 360, label: "Horizontal" },
  "9:16": { ratio: "9 / 16", maxHeight: 480, label: "Vertical" },
  "1:1": { ratio: "1 / 1", maxHeight: 400, label: "Square" },
};

/**
 * One of Wanlly's own MP4 ads (Admin → Advertisers → Video ads), played in the rewarded spots.
 * `url` is a file in public/ads (served by the site itself) or any direct https MP4 link.
 */
export type HouseVideo = { id: number; title: string; brand: string; url: string; aspect: VideoAspect; durationMs: number; cta: string; link: string };
/** Video ads may run this long; credits are paid only after the whole video has played. */
export const VIDEO_MIN_MS = 5_000;
/** What the rewarded spots play when no video ad is switched on: Wanlly's own 20-second promo (public/ads). */
export const BUILTIN_VIDEO: HouseVideo = { id: 0, title: "Wanlly promo", brand: "Wanlly", url: "/ads/wanlly-promo-16x9.mp4", aspect: "16:9", durationMs: 20_000, cta: "", link: "" };
export const VIDEO_MAX_MS = 60_000;

/** Standard (IAB) display sizes. Networks require the exact pixel size, so slots pick one that fits rather than scaling it. */
export type DisplaySize = "336x280" | "300x250" | "320x50" | "300x600" | "160x600" | "728x90" | "970x250";

export const DISPLAY_SIZES: Record<DisplaySize, { w: number; h: number; name: string }> = {
  "336x280": { w: 336, h: 280, name: "Large rectangle" },
  "300x250": { w: 300, h: 250, name: "Medium rectangle" },
  "320x50": { w: 320, h: 50, name: "Mobile banner" },
  "300x600": { w: 300, h: 600, name: "Half page" },
  "160x600": { w: 160, h: 600, name: "Wide skyscraper" },
  "728x90": { w: 728, h: 90, name: "Leaderboard" },
  "970x250": { w: 970, h: 250, name: "Billboard" },
};

/** Where an ad can appear, and which sizes each place asks networks for, largest first. */
export type Placement = "card" | "line" | "rail";

export const PLACEMENT_SIZES: Record<Placement, DisplaySize[]> = {
  card: ["336x280", "300x250"],
  line: ["320x50"],
  rail: ["300x600", "160x600"],
};

export type AdCreative =
  | { kind: "native"; sponsor: Sponsor }
  | { kind: "display"; sponsor: Sponsor }
  | { kind: "video"; sponsor: Sponsor; aspect: VideoAspect };

/** Largest size in the list that fits the width available; null when none fit. */
export function pickSize(sizes: DisplaySize[], width: number, inset = 0): DisplaySize | null {
  return sizes.find((s) => DISPLAY_SIZES[s].w <= width - inset) ?? null;
}
