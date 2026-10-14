// The site's worker: OpenNext's, plus ad-network verification without code changes.
//  - SITE_TAGS: paste the <meta …> tags networks give you (any number, any order). Each page's
//    <head> gets them. Only <meta name|property=… content=…> tags are used; anything else is ignored.
//  - ADS_TXT: the lines networks ask for in ads.txt (one per line), served at /ads.txt.
// Both are plain-text variables in Cloudflare (Workers → wanlly → Settings → Variables).
import site from "../../.open-next/worker.js";

export * from "../../.open-next/worker.js";

const escape = (v) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** `<meta name="x" content="y">` tags from pasted text, rebuilt clean (no other attributes or tags). */
function metaTags(text) {
  const out = [];
  for (const m of String(text || "").matchAll(/<meta\b[^>]*>/gi)) {
    const attr = (k) => m[0].match(new RegExp(`\\b${k}\\s*=\\s*["']([^"']{1,200})["']`, "i"))?.[1];
    const key = attr("name") ? "name" : attr("property") ? "property" : null;
    const content = attr("content");
    if (!key || !content || out.length >= 20) continue;
    out.push(`<meta ${key}="${escape(attr(key))}" content="${escape(content)}">`);
  }
  return out.join("");
}

const worker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/ads.txt" && env.ADS_TXT) {
      const body = String(env.ADS_TXT).replace(/\\n/g, "\n").trim() + "\n";
      return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
    }
    const res = await site.fetch(request, env, ctx);
    const tags = env.SITE_TAGS ? metaTags(env.SITE_TAGS) : "";
    if (!tags || !(res.headers.get("content-type") || "").includes("text/html")) return res;
    return new HTMLRewriter().on("head", { element: (head) => head.append(tags, { html: true }) }).transform(res);
  },
  // Daily jobs (the cron in wrangler.jsonc): come-back emails. The app decides whether they're on.
  async scheduled(event, env, ctx) {
    const secret = env.CRON_SECRET || env.CLERK_SECRET_KEY;
    if (!secret) return;
    const req = new Request("https://wanlly.africa/api/cron/nudges", { method: "POST", headers: { authorization: `Bearer ${secret}` } });
    ctx.waitUntil(
      site.fetch(req, env, ctx).then(async (r) => console.log("cron nudges", r.status, (await r.text()).slice(0, 300))),
    );
  },
};

export default worker;
