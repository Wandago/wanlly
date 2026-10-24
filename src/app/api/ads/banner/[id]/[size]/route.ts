import { rawSql } from "@/db";
import { servePicture } from "@/lib/ad-picture-serve";
import { BANNER_SIZES } from "@/lib/campaigns";

/** One of a campaign's banner pictures, by size, served as an image so slots can cache it. */
export async function GET(req: Request, ctx: RouteContext<"/api/ads/banner/[id]/[size]">) {
  const { id: rawId, size } = await ctx.params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0 || !BANNER_SIZES.includes(size as (typeof BANNER_SIZES)[number])) return new Response(null, { status: 400 });
  try {
    return await servePicture(req, async () => {
      const [row] = (await rawSql()`select to_jsonb(c)->'banners'->>${size} as data from campaigns c where c.id = ${id}`) as { data: string | null }[];
      return row?.data;
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
