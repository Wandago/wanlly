import "server-only";
import { field } from "./forms";

/* Directly sold ads: what a campaign may contain, checked before it's saved. */

export const PLACEMENTS = ["rail_cover", "rail_banner", "sidebar_card", "phone_banner", "job_card", "job_line", "interstitial"] as const;
export const COVERS = ["db", "deploy", "type", "print", "notes", "laptop", "course", "jobs"] as const;
export const CATEGORIES = ["Learning and courses", "Developer tools", "Laptops and phones", "Jobs and internships", "Money and banking", "Design tools", "Telecoms and data", "Student services", "Other"] as const;
export const FORMATS = ["Sponsor cards", "Banners", "Sponsored videos", "Pop-up cards", "Sponsor trials"] as const;

const isHex = (s: string) => /^#[0-9a-f]{6}$/i.test(s);
function httpsUrl(s: string) {
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
function date(v: unknown) {
  if (v === null || v === "") return null;
  if (typeof v !== "string") return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export type CampaignInput = Partial<{
  advertiser: string;
  name: string;
  status: "draft" | "active" | "paused" | "ended";
  headline: string;
  body: string;
  cta: string;
  url: string;
  color: string;
  cover: string | null;
  image: string | null;
  placements: string[];
  countries: string[];
  startsAt: Date | null;
  endsAt: Date | null;
  maxImpressions: number | null;
  cpmCents: number;
  applicationId: number | null;
}>;

/** The valid fields present in a request; an error message for the first invalid one. */
export function campaignFields(d: Record<string, unknown>): { ok: CampaignInput } | { error: string } {
  const out: CampaignInput = {};
  for (const [k, max] of [["advertiser", 80], ["name", 80], ["headline", 90], ["body", 160], ["cta", 24]] as const) if (k in d) out[k] = field(d, k, max);
  if ("status" in d) {
    if (!["draft", "active", "paused", "ended"].includes(String(d.status))) return { error: "Unknown status." };
    out.status = d.status as CampaignInput["status"];
  }
  if ("url" in d) {
    const u = httpsUrl(field(d, "url", 400));
    if (!u) return { error: "The link must be a full https:// address." };
    out.url = u;
  }
  if ("color" in d) {
    if (!isHex(field(d, "color", 7))) return { error: "Pick a colour like #2a78d6." };
    out.color = field(d, "color", 7);
  }
  if ("cover" in d) out.cover = COVERS.includes(d.cover as (typeof COVERS)[number]) ? (d.cover as string) : null;
  if ("image" in d) {
    if (d.image === null || d.image === "") out.image = null;
    else if (typeof d.image === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(d.image) && d.image.length < 280_000) out.image = d.image;
    else return { error: "The picture must be a PNG, JPEG or WebP under 200 KB." };
  }
  if ("placements" in d) {
    if (!Array.isArray(d.placements)) return { error: "Bad placements." };
    out.placements = PLACEMENTS.filter((p) => (d.placements as unknown[]).includes(p));
  }
  if ("countries" in d) {
    if (!Array.isArray(d.countries)) return { error: "Bad countries." };
    out.countries = [...new Set((d.countries as unknown[]).map((c) => String(c).toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)))].slice(0, 60);
  }
  for (const k of ["startsAt", "endsAt"] as const)
    if (k in d) {
      const v = date(d[k]);
      if (v === undefined) return { error: "Bad date." };
      out[k] = v;
    }
  if ("maxImpressions" in d) out.maxImpressions = d.maxImpressions === null || d.maxImpressions === "" ? null : Math.max(0, Math.min(1e9, Math.round(Number(d.maxImpressions)) || 0));
  if ("cpmCents" in d) out.cpmCents = Math.max(0, Math.min(1e6, Math.round(Number(d.cpmCents)) || 0));
  if ("applicationId" in d) out.applicationId = Number.isSafeInteger(d.applicationId) ? (d.applicationId as number) : null;
  return { ok: out };
}
