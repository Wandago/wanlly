import "server-only";

/** Sends an ad picture stored as a data URL, kept in Cloudflare's edge cache for 10 minutes. */
export async function servePicture(req: Request, load: () => Promise<string | null | undefined>): Promise<Response> {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(req.url, { method: "GET" });
  const hit = cache ? await cache.match(key).catch(() => undefined) : undefined;
  if (hit) return hit;
  const value = await load();
  // A picture shipped with the site (public/ads): the browser fetches it from there.
  if (value?.startsWith("/ads/") && !value.includes("..")) return Response.redirect(new URL(value, req.url).toString(), 302);
  const m = value?.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/);
  if (!m) return new Response(null, { status: 404 });
  const res = new Response(Buffer.from(m[2], "base64"), {
    headers: { "content-type": m[1], "cache-control": "public, max-age=3600, s-maxage=600", "x-content-type-options": "nosniff" },
  });
  if (cache) await cache.put(key, res.clone()).catch(() => {});
  return res;
}
