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

/**
 * After a deploy, a page loaded (or restored) from before it still asks for the old build's
 * stylesheets, which are gone, so it showed as plain unstyled HTML. Those requests get the current
 * build's styles instead: read from the home page's <link>s, once per isolate.
 */
let currentCss = null;
async function cssFallback(request, env, ctx) {
  currentCss ??= (async () => {
    const home = await site.fetch(new Request(new URL("/", request.url)), env, ctx);
    const links = [...new Set([...(await home.text()).matchAll(/href="(\/_next\/static\/[^"]+\.css)"/g)].map((m) => m[1]))];
    const parts = await Promise.all(links.map((href) => env.ASSETS.fetch(new URL(href, request.url)).then((r) => (r.ok ? r.text() : ""))));
    const css = parts.join("\n");
    if (!css) throw new Error("no stylesheets found");
    return css;
  })().catch((e) => {
    currentCss = null;
    throw e;
  });
  const css = await currentCss;
  return new Response(css, { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "no-store" } });
}

const worker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/ads.txt" && env.ADS_TXT) {
      const body = String(env.ADS_TXT).replace(/\\n/g, "\n").trim() + "\n";
      return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
    }
    const res = await site.fetch(request, env, ctx);
    if (res.status === 404 && /^\/_next\/static\/.+\.css$/.test(url.pathname)) return cssFallback(request, env, ctx).catch(() => res);
    const tags = env.SITE_TAGS ? metaTags(env.SITE_TAGS) : "";
    if (!tags || !(res.headers.get("content-type") || "").includes("text/html")) return res;
    return new HTMLRewriter().on("head", { element: (head) => head.append(tags, { html: true }) }).transform(res);
  },
  // Hourly jobs (the cron in wrangler.jsonc): announcement batches and, once a day, come-back emails.
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
