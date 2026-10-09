import { CAN, requireStaff } from "@/lib/admin";

/*
 * A quick look at an affiliate link's landing page for Admin: its title, description, site name
 * and share picture (Open Graph tags), so the team can check the link and reuse the picture on
 * the ad. Only https pages on public hostnames, read up to 400 KB, with a short timeout.
 */

const META = /<meta\s+[^>]*>/gi;
const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.advertisers);
  if (staff instanceof Response) return staff;
  let target: URL;
  try {
    target = new URL(new URL(req.url).searchParams.get("url") ?? "");
  } catch {
    return Response.json({ error: "That isn't a link." }, { status: 400 });
  }
  if (target.protocol !== "https:" || /^(localhost|\d+\.\d+\.\d+\.\d+|\[.*\])$/i.test(target.hostname) || !target.hostname.includes("."))
    return Response.json({ error: "Only https links to public sites can be previewed." }, { status: 400 });
  try {
    const r = await fetch(target, {
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; WanllyLinkPreview/1.0)", accept: "text/html" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok || !r.body) return Response.json({ error: `The page answered ${r.status}.` }, { status: 502 });
    // Read only the start of the page: the tags we need are in <head>.
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let html = "";
    while (html.length < 400_000) {
      const { value, done } = await reader.read();
      if (done) break;
      html += dec.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
    reader.cancel().catch(() => {});
    const meta: Record<string, string> = {};
    for (const tag of html.match(META) ?? []) {
      const key = (attr(tag, "property") ?? attr(tag, "name"))?.toLowerCase();
      const content = attr(tag, "content");
      if (key && content && !meta[key]) meta[key] = decode(content);
    }
    const base = r.url || target.toString();
    const abs = (v?: string) => {
      if (!v) return undefined;
      try {
        const u = new URL(v, base);
        return u.protocol === "https:" ? u.toString() : undefined;
      } catch {
        return undefined;
      }
    };
    const title = meta["og:title"] ?? meta["twitter:title"] ?? decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "");
    // Bot checks (Cloudflare and others) answer with a holding page instead of the real one.
    if (/^(just a moment|attention required|access denied|please wait)/i.test(title) && !meta["og:title"])
      return Response.json({ error: "This site blocks link previews. The link still works; paste a picture link below if you want one on the ad." }, { status: 422 });
    return Response.json({
      url: base,
      host: new URL(base).hostname.replace(/^www\./, ""),
      title: title.slice(0, 160),
      description: (meta["og:description"] ?? meta["twitter:description"] ?? meta["description"] ?? "").slice(0, 300),
      site: (meta["og:site_name"] ?? "").slice(0, 60),
      image: abs(meta["og:image"] ?? meta["og:image:url"] ?? meta["twitter:image"] ?? meta["twitter:image:src"]),
    });
  } catch (e) {
    return Response.json({ error: `Couldn't open the page: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }
}
