import type { CoverKind, Sponsor } from "./catalog";

/*
 * Affiliate links: Wanlly's own "house" ads, edited in Admin. They fill any place no sold
 * campaign has booked, instead of the built-in placeholders. Keywords let a slot pick the offer
 * that matches what someone is working on (hosting after a website question, a course after a
 * coding one). Matching happens in the browser; no chat text is sent anywhere for it.
 */

export const AFFILIATE_PLACES = ["rail_cover", "sidebar_card", "job_card", "job_line", "interstitial", "phone_banner"] as const;
export const COVER_KINDS: CoverKind[] = ["laptop", "course", "jobs", "notes", "db", "deploy", "type", "print"];

export type Affiliate = {
  id: string;
  active: boolean;
  name: string;
  headline: string;
  text: string;
  cta: string;
  url: string;
  color: string;
  cover: CoverKind;
  /** Words that make this offer a good match, e.g. ["website", "hosting", "domain"]. */
  keywords: string[];
  places: string[];
  /** The landing page's share picture (https), shown on the ad when set. */
  image?: string;
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function httpsUrl(v: unknown): string | undefined {
  try {
    const u = new URL(str(v, 800));
    return u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function cleanAffiliates(v: unknown): Affiliate[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 40).flatMap((raw, i): Affiliate[] => {
    if (!raw || typeof raw !== "object") return [];
    const o = raw as Record<string, unknown>;
    let url = "";
    try {
      const u = new URL(str(o.url, 500));
      if (u.protocol === "https:") url = u.toString();
    } catch {}
    const name = str(o.name, 60);
    if (!name || !url) return [];
    return [
      {
        id: /^[\w-]{1,40}$/.test(String(o.id)) ? String(o.id) : `a${i}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20)}`,
        active: o.active !== false,
        name,
        headline: str(o.headline, 90) || name,
        text: str(o.text, 160),
        cta: str(o.cta, 24) || "Learn more",
        url,
        color: /^#[0-9a-f]{6}$/i.test(str(o.color, 7)) ? str(o.color, 7) : "#2a78d6",
        cover: COVER_KINDS.includes(o.cover as CoverKind) ? (o.cover as CoverKind) : "laptop",
        keywords: Array.isArray(o.keywords)
          ? [...new Set((o.keywords as unknown[]).map((k) => String(k).toLowerCase().trim().slice(0, 30)).filter(Boolean))].slice(0, 20)
          : [],
        places: Array.isArray(o.places) ? AFFILIATE_PLACES.filter((p) => (o.places as unknown[]).includes(p)) : [...AFFILIATE_PLACES],
        image: httpsUrl(o.image),
      },
    ];
  });
}

/** An affiliate as a sponsor card/line can show it. */
export const affiliateSponsor = (a: Affiliate): Sponsor & { affiliateId: string; keywords: string[]; places: string[] } => ({
  name: a.name,
  initial: a.name.charAt(0).toUpperCase(),
  color: a.color,
  cover: a.cover,
  headline: a.headline,
  text: a.text,
  cta: a.cta,
  url: a.url,
  image: a.image,
  affiliateId: a.id,
  keywords: a.keywords,
  places: a.places,
});

/** How well an offer's keywords match some text: whole-word hits, longer words count more. */
export function matchScore(keywords: string[] | undefined, text: string): number {
  if (!keywords?.length || !text) return 0;
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9+#]+/g, " ")} `;
  return keywords.reduce((n, k) => (t.includes(` ${k.replace(/[^a-z0-9+#]+/g, " ").trim()} `) ? n + 1 + Math.min(k.length, 12) / 12 : n), 0);
}
