/*
 * A display ad network (Adsterra, A-ADS, or any network that gives "paste this code" banners).
 * The team pastes one banner code per size in Admin → Ads. Each banner then runs in its own
 * locked-down frame served from /api/ads/unit, so a network's script can never reach the app,
 * the signed-in account or the page around it.
 */

export const NETWORK_SIZES = ["300x250", "320x50", "728x90", "468x60", "160x600", "300x600", "336x280", "320x100"] as const;
export type NetworkSize = (typeof NETWORK_SIZES)[number];

export type NetworkConfig = {
  /** Shown in admin and used to name its ad events, e.g. "adsterra". */
  name: string;
  /** Who sees network ads: nobody, the team only (to check them), or everyone. */
  audience: "off" | "staff" | "everyone";
  /** Banner code per size. */
  units: Partial<Record<NetworkSize, string>>;
  /**
   * Optional separate address that serves the banners (the small "ad frame" Worker in
   * workers/ad-frame). Banners there get their own origin, so they may use storage without any
   * access to Wanlly. Empty: banners come from Wanlly itself, fully sandboxed.
   */
  host?: string;
  /** A native ad unit (e.g. Adsterra's Native Banner): a row of picture-and-headline ads. */
  native?: string;
  /** Height of the native row in px; the unit fills the width. */
  nativeHeight?: number;
  /**
   * What the team expects this network to pay per 1,000 views, in US dollars. Used to rank it
   * until enough real views and earnings are in to measure it (see lib/ad-rank.ts).
   */
  ecpm?: number;
};

/**
 * Every network, with one shared banner host. Slots go to the best-paying network that has the
 * size; when it has no ad to show, the next one gets the slot.
 */
export type NetworksConfig = { host?: string; list: NetworkConfig[] };
export const NO_NETWORKS: NetworksConfig = { list: [] };
export const MAX_NETWORKS = 6;

export const NO_NETWORK: NetworkConfig = { name: "", audience: "off", units: {} };

function httpsOrigin(v: unknown): string | undefined {
  if (typeof v !== "string" || !v.trim()) return undefined;
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" ? u.origin : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A banner code that is just an iframe pointing at the network's own site (A-ADS and others):
 * its https address, or null. Such banners already run on the network's own origin, so they can
 * be shown straight away, with no banner host and no script of theirs on Wanlly's pages.
 */
export function directSrc(code: string | undefined): string | null {
  if (!code || /<script/i.test(code)) return null;
  const frames = [...code.matchAll(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)];
  if (frames.length !== 1) return null;
  const raw = frames[0][1].trim().replace(/&amp;/g, "&");
  const url = raw.startsWith("//") ? `https:${raw}` : raw;
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * The banner host's page for one banner: the code travels after "#", which browsers never send
 * to a server, so the host just returns the same small page every time.
 */
export function frameUrl(host: string, code: string): string {
  const bytes = new TextEncoder().encode(code);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return `${host}/frame#${btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

export const sizeOf = (s: NetworkSize) => {
  const [w, h] = s.split("x").map(Number);
  return { w, h };
};

/** Keeps only what the admin form may set. Codes are capped in length; they run sandboxed. */
export function cleanNetwork(v: unknown): NetworkConfig {
  if (!v || typeof v !== "object") return NO_NETWORK;
  const o = v as Record<string, unknown>;
  const units: NetworkConfig["units"] = {};
  const raw = (o.units ?? {}) as Record<string, unknown>;
  for (const s of NETWORK_SIZES) if (typeof raw[s] === "string" && raw[s].trim()) units[s] = raw[s].trim().slice(0, 4000);
  return {
    name: typeof o.name === "string" ? o.name.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30) : "",
    audience: o.audience === "staff" || o.audience === "everyone" ? o.audience : "off",
    units,
    host: httpsOrigin(o.host),
    native: typeof o.native === "string" && o.native.trim() ? o.native.trim().slice(0, 4000) : undefined,
    nativeHeight: Math.max(100, Math.min(600, Math.round(Number(o.nativeHeight)) || 280)),
    ecpm: Number(o.ecpm) > 0 ? Math.min(100, Math.round(Number(o.ecpm) * 100) / 100) : undefined,
  };
}

/** Keeps what the admin form may set: the host and up to MAX_NETWORKS named, distinct networks. */
export function cleanNetworks(v: unknown): NetworksConfig {
  if (!v || typeof v !== "object") return NO_NETWORKS;
  const o = v as Record<string, unknown>;
  const seen = new Set<string>();
  const list = (Array.isArray(o.list) ? o.list : [])
    .map(cleanNetwork)
    .filter((n) => n.name && !seen.has(n.name) && seen.add(n.name))
    .slice(0, MAX_NETWORKS)
    // The host is shared, so a network's own (from the one-network days) is dropped.
    .map((n) => ({ ...n, host: undefined }));
  return { host: httpsOrigin(o.host), list };
}
