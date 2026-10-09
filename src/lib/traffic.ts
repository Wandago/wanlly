import "server-only";

/* Cookieless visitor counting. Nothing here is stored that could identify a person on its own. */

const BOTS = /bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|curl|wget|python|httpclient|go-http|axios|node-fetch|facebookexternalhit|embedly|whatsapp/i;

export const isBot = (ua: string) => !ua || BOTS.test(ua);

export function device(ua: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}

let key: Promise<CryptoKey> | null = null;

/**
 * A keyed hash of network address + browser + UTC day. The key is a server secret, so the hash
 * can't be reversed by trying addresses, and the day in it means it changes every midnight.
 */
export async function visitorHash(req: Request): Promise<string> {
  const secret = process.env.ANALYTICS_SALT || process.env.CLERK_SECRET_KEY || "wanlly";
  key ??= crypto.subtle.importKey("raw", new TextEncoder().encode(`visitor:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ua = req.headers.get("user-agent") ?? "";
  const day = new Date().toISOString().slice(0, 10);
  const sig = await crypto.subtle.sign("HMAC", await key, new TextEncoder().encode(`${day}|${ip}|${ua}`));
  return Array.from(new Uint8Array(sig).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}
