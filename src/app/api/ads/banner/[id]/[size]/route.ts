import { rawSql } from "@/db";
import { BANNER_SIZES } from "@/lib/campaigns";

/** One of a campaign's banner pictures, by size, served as an image so slots can cache it. */
export async function GET(_req: Request, ctx: RouteContext<"/api/ads/banner/[id]/[size]">) {
  const { id: rawId, size } = await ctx.params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0 || !BANNER_SIZES.includes(size as (typeof BANNER_SIZES)[number])) return new Response(null, { status: 400 });
  try {
    const q = rawSql();
    const [row] = (await q`select to_jsonb(c)->'banners'->>${size} as data from campaigns c where c.id = ${id}`) as { data: string | null }[];
    const m = row?.data?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
    if (!m) return new Response(null, { status: 404 });
    const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    return new Response(bytes, { headers: { "content-type": m[1], "cache-control": "public, max-age=3600", "x-content-type-options": "nosniff" } });
  } catch {
    return new Response(null, { status: 503 });
  }
}
