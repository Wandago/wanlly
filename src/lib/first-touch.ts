/*
 * Where someone first came from: the utm tags or referring site on their first visit, kept in
 * their own browser and only sent when they choose to apply. Lets the team see which channels
 * bring people who actually apply, next to what they said on the form.
 */

export type FirstTouch = {
  /** utm_source, utm_medium, utm_campaign from the first link they opened. */
  source?: string;
  medium?: string;
  campaign?: string;
  /** The other site that sent them, host only. */
  referrer?: string;
  /** The first Wanlly page they saw. */
  landing?: string;
  /** When, as an ISO date. */
  at?: string;
};

const KEY = "wanlly-first-touch";

/** Saves the first visit's details once. Later visits never overwrite it. */
export function rememberFirstTouch(path: string) {
  try {
    if (localStorage.getItem(KEY)) return;
    const q = new URLSearchParams(window.location.search);
    let referrer: string | undefined;
    try {
      const host = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "";
      if (host && host !== window.location.hostname.replace(/^www\./, "")) referrer = host;
    } catch {}
    const touch: FirstTouch = {
      source: q.get("utm_source") ?? undefined,
      medium: q.get("utm_medium") ?? undefined,
      campaign: q.get("utm_campaign") ?? undefined,
      referrer,
      landing: path,
      at: new Date().toISOString().slice(0, 10),
    };
    localStorage.setItem(KEY, JSON.stringify(touch));
  } catch {}
}

export function readFirstTouch(): FirstTouch | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}

const clean = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

/** The server keeps only short strings it expects. */
export function cleanFirstTouch(v: unknown): FirstTouch | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const t: FirstTouch = {
    source: clean(o.source, 60)?.toLowerCase(),
    medium: clean(o.medium, 60)?.toLowerCase(),
    campaign: clean(o.campaign, 80),
    referrer: clean(o.referrer, 80)?.toLowerCase(),
    landing: clean(o.landing, 120)?.startsWith("/") ? clean(o.landing, 120) : undefined,
    at: /^\d{4}-\d{2}-\d{2}$/.test(String(o.at)) ? String(o.at) : undefined,
  };
  return Object.values(t).some(Boolean) ? t : null;
}

const CHANNELS: [RegExp, string][] = [
  [/tiktok/, "TikTok"],
  [/instagram|^ig$/, "Instagram"],
  [/facebook|^fb$|^meta$|fb\.me/, "Facebook"],
  [/^t\.co$|twitter|^x$|^x\.com$/, "X"],
  [/linkedin|lnkd\.in/, "LinkedIn"],
  [/whatsapp|wa\.me/, "WhatsApp"],
  [/youtube|youtu\.be/, "YouTube"],
  [/reddit/, "Reddit"],
  [/producthunt/, "Product Hunt"],
  [/chatgpt|openai|perplexity|claude\.ai|gemini\.google|copilot/, "AI assistants"],
  [/mail|newsletter|substack/, "Email"],
  [/google|bing|duckduckgo|yahoo|ecosia|brave|yandex/, "Search"],
];

/** One channel name for a first touch: utm_source wins, then the referring site, else Direct. */
export function channelOf(t: FirstTouch | null, invited = false): string {
  const raw = t?.source || t?.referrer;
  if (!raw) return invited ? "Invite link" : "Direct";
  const hit = CHANNELS.find(([re]) => re.test(raw));
  return hit ? hit[1] : raw.slice(0, 40);
}
