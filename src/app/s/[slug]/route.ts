import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { loadAffiliates } from "@/lib/affiliates-server";
import { SITE_URL } from "@/lib/site";

/*
 * A published Builder app. It is served with a sandbox policy, so it runs with no origin of its
 * own: it can't read Wanlly's cookies or storage, call Wanlly as the visitor, or navigate the
 * page away; links open in new tabs. A small bar credits Wanlly, shows one sponsor (part of how
 * Wanlly stays free) and lets anyone report the page. Search engines are asked not to index it.
 */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function GET(_req: Request, ctx: RouteContext<"/s/[slug]">) {
  const slug = (await ctx.params).slug;
  const [site] = await db()
    .select({ html: schema.publishedSites.html, disabled: schema.publishedSites.disabled })
    .from(schema.publishedSites)
    .where(eq(schema.publishedSites.slug, slug))
    .limit(1)
    .catch(() => []);
  if (!site || site.disabled) return new Response("This app isn't available.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const sponsor = (await loadAffiliates().catch(() => [])).find((a) => a.active);
  const link = (url: string) => {
    const u = new URL(url);
    u.searchParams.set("utm_source", "wanlly");
    u.searchParams.set("utm_medium", "published-app");
    return u.toString();
  };
  const bar = `<div style="position:fixed;right:10px;bottom:10px;z-index:2147483647;display:flex;gap:8px;align-items:center;padding:6px 10px;border-radius:999px;background:#0b0b0d;color:#fbfbfc;font:500 12px/1.2 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.25)"><a href="${esc(link(SITE_URL))}" target="_blank" rel="noopener" style="color:#fbfbfc;text-decoration:none">Built free with <b style="color:#ff5a1f">Wanlly</b></a>${sponsor ? `<span style="opacity:.5">·</span><a href="${esc(link(sponsor.url))}" target="_blank" rel="noopener sponsored" style="color:#fbfbfc;opacity:.8;text-decoration:none">Sponsored: ${esc(sponsor.name)}</a>` : ""}<span style="opacity:.5">·</span><a href="${esc(`${SITE_URL}/contact?topic=report&site=${encodeURIComponent(slug)}`)}" target="_blank" rel="noopener" style="color:#fbfbfc;opacity:.6;text-decoration:none">Report</a></div>`;
  const html = /<\/body>/i.test(site.html) ? site.html.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${bar}</body>`) : site.html + bar;
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "sandbox allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox",
      "x-robots-tag": "noindex",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "cache-control": "public, max-age=60",
    },
  });
}
