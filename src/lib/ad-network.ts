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
};

export const NO_NETWORK: NetworkConfig = { name: "", audience: "off", units: {} };

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
  };
}
