/*
 * Wanlly ad frame: serves ad-network banners from their own address, separate from the app.
 *
 * Why: banners served by Wanlly itself run with no origin at all, and some networks' scripts
 * need storage to show an ad. Served from here, a banner keeps this Worker's origin, which is a
 * different site from Wanlly, so it still can't read Wanlly's cookies, storage or pages.
 *
 * Set up (Cloudflare dashboard → Workers & Pages → Create → Worker): name it e.g. "wanlly-ads",
 * paste this file, Deploy. Then put its address in Admin → Ads → Ad network → Banner host.
 */

// The Wanlly app this frame takes banner code from. Change it if the app moves to a new domain.
const APP = "https://wanlly.louiswandago.workers.dev";

const worker = {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/ads/unit") return new Response("Not found", { status: 404 });
    const res = await fetch(`${APP}/api/ads/unit${url.search}`, { cf: { cacheTtl: 300, cacheEverything: true } });
    return new Response(res.ok ? await res.text() : null, {
      status: res.status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300",
        "x-content-type-options": "nosniff",
        // Only Wanlly may show these pages in a frame.
        "content-security-policy": `frame-ancestors ${APP}`,
      },
    });
  },
};

export default worker;
