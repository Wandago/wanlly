import { rawSql } from "@/db";
import { directSrc } from "@/lib/ad-network";
import { loadNetwork } from "@/lib/ad-network-server";
import { affiliateSponsor } from "@/lib/affiliates";
import { loadAffiliates } from "@/lib/affiliates-server";

/**
 * Directly sold ads that may show right now to someone in this country, with where they may show.
 * Public and cached for a few minutes; pictures come from /api/ads/image/[id].
 */
export async function GET(req: Request) {
  const country = (req.headers.get("cf-ipcountry") ?? "").toUpperCase();
  try {
    const q = rawSql();
    const rows = (await q`
      select c.id, c.advertiser, c.headline, c.body, c.cta, c.url, c.color, c.cover, (c.image is not null) as has_image, c.placements,
        (to_jsonb(c)->>'frequency_cap')::int as frequency_cap,
        (select coalesce(jsonb_agg(k), '[]'::jsonb) from jsonb_object_keys(coalesce(to_jsonb(c)->'banners', '{}'::jsonb)) k) as banner_sizes
      from campaigns c
      where c.status = 'active'
        and (c.starts_at is null or c.starts_at <= now())
        and (c.ends_at is null or c.ends_at > now())
        and (jsonb_array_length(c.countries) = 0 or c.countries ? ${country})
        and (c.max_impressions is null or c.max_impressions > (
          select count(*) from ad_events a where a.creative = 'campaign:' || c.id and a.kind = 'impression'))
      order by c.id desc limit 20`) as Record<string, unknown>[];
    // Which network sizes are set up, and for whom. The codes themselves stay in /api/ads/unit.
    const [network, affiliates] = await Promise.all([loadNetwork(), loadAffiliates()]);
    return Response.json(
      {
        // The visitor's own network country, so the team can see why a campaign isn't shown.
        country,
        // Wanlly's affiliate offers, for places no sold campaign has booked.
        house: affiliates.filter((a) => a.active).map(affiliateSponsor),
        // Iframe-only banners (A-ADS…) run on the network's own site and need nothing more. Script
        // banners (Adsterra…) need the banner host: inside Wanlly's sandbox they load blank.
        network: (() => {
          if (network.audience === "off") return null;
          const direct: Record<string, string> = {};
          const codes: Record<string, string> = {};
          const sizes: string[] = [];
          for (const [size, code] of Object.entries(network.units)) {
            const src = directSrc(code);
            if (src) direct[size] = src;
            else if (network.host && code) codes[size] = code;
            if (src || network.host) sizes.push(size);
          }
          // The native row needs the banner host (its script, like any network script).
          const native = network.native && network.host ? { code: network.native, height: network.nativeHeight ?? 280 } : undefined;
          return sizes.length || native ? { name: network.name, audience: network.audience, sizes, host: network.host, direct, codes, native } : null;
        })(),
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
          cap: r.frequency_cap === null ? undefined : Number(r.frequency_cap),
          banners: Array.isArray(r.banner_sizes) && r.banner_sizes.length ? r.banner_sizes : undefined,
        })),
      },
      { headers: { "cache-control": "private, max-age=300", vary: "cf-ipcountry" } },
    );
  } catch (e) {
    console.error("ads GET failed", e);
    return Response.json({ ads: [] });
  }
}
