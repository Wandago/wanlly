import { db, schema } from "@/db";
import { device, isBot, visitorHash } from "@/lib/traffic";

/** Page-view beacon. Public, cookieless, and as cheap as possible: one insert, no sign-in check. */
export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") ?? "";
  if (isBot(ua)) return new Response(null, { status: 204 });
  const text = await req.text();
  if (text.length > 1024) return new Response(null, { status: 413 });
  let data: { p?: unknown; r?: unknown; u?: unknown };
  try {
    data = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const path = typeof data.p === "string" && data.p.startsWith("/") ? data.p.split(/[?#]/)[0].slice(0, 120) : null;
  if (!path) return new Response(null, { status: 400 });

  // Keep only the referring site's name, and only when it's another site.
  let referrer: string | null = null;
  if (typeof data.r === "string" && data.r) {
    try {
      const host = new URL(data.r).hostname.replace(/^www\./, "");
      if (host && host !== new URL(req.url).hostname) referrer = host.slice(0, 80);
    } catch {}
  }
  const utmSource = typeof data.u === "string" && data.u ? data.u.toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 40) || null : null;

  try {
    await db()
      .insert(schema.pageViews)
      .values({ path, referrer, utmSource, country: req.headers.get("cf-ipcountry"), device: device(ua), visitor: await visitorHash(req) });
  } catch (e) {
    console.error("page view failed", e);
  }
  return new Response(null, { status: 204 });
}
