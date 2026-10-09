import { rawSql } from "@/db";

/**
 * Directly sold ads that may show right now to someone in this country, with where they may show.
 * Public and cached for a few minutes; pictures come from /api/ads/image/[id].
 */
export async function GET(req: Request) {
  const country = (req.headers.get("cf-ipcountry") ?? "").toUpperCase();
  try {
    const q = rawSql();
    const rows = (await q`
      select c.id, c.advertiser, c.headline, c.body, c.cta, c.url, c.color, c.cover, (c.image is not null) as has_image, c.placements
      from campaigns c
      where c.status = 'active'
        and (c.starts_at is null or c.starts_at <= now())
        and (c.ends_at is null or c.ends_at > now())
        and (jsonb_array_length(c.countries) = 0 or c.countries ? ${country})
        and (c.max_impressions is null or c.max_impressions > (
          select count(*) from ad_events a where a.creative = 'campaign:' || c.id and a.kind = 'impression'))
      order by c.id desc limit 20`) as Record<string, unknown>[];
    return Response.json(
      {
        ads: rows.map((r) => ({
          campaignId: Number(r.id),
          name: String(r.advertiser),
          initial: String(r.advertiser).trim().charAt(0).toUpperCase() || "A",
          headline: String(r.headline),
          text: String(r.body),
          cta: String(r.cta),
          url: String(r.url),
          color: String(r.color),
          cover: r.cover ?? undefined,
          image: r.has_image ? `/api/ads/image/${r.id}` : undefined,
          placements: r.placements,
        })),
      },
      { headers: { "cache-control": "public, max-age=300" } },
    );
  } catch (e) {
    console.error("ads GET failed", e);
    return Response.json({ ads: [] });
  }
}
