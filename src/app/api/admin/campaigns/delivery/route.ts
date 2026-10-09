import { rawSql } from "@/db";
import { CAN, requireStaff } from "@/lib/admin";

/**
 * The ad server's rules, checked one by one for every active or paused campaign, for the person
 * asking (their network country). Says exactly why a campaign is or isn't being served.
 */
export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.view);
  if (staff instanceof Response) return staff;
  const country = (req.headers.get("cf-ipcountry") ?? "").toUpperCase();
  try {
    const q = rawSql();
    const rows = (await q`
      select c.id, c.name, c.advertiser, c.status, c.placements, c.countries, c.starts_at, c.ends_at, c.max_impressions,
        (to_jsonb(c)->>'frequency_cap')::int as frequency_cap,
        (c.starts_at is null or c.starts_at <= now()) as started,
        (c.ends_at is null or c.ends_at > now()) as not_ended,
        (jsonb_array_length(c.countries) = 0 or c.countries ? ${country}) as country_ok,
        (select count(*) from ad_events a where a.creative = 'campaign:' || c.id and a.kind = 'impression')::int as views
      from campaigns c where c.status in ('active', 'paused', 'draft')
      order by c.id desc limit 50`) as Record<string, unknown>[];
    return Response.json({
      country,
      now: new Date().toISOString(),
      campaigns: rows.map((r) => {
        const views = Number(r.views);
        const max = r.max_impressions === null ? null : Number(r.max_impressions);
        const checks = {
          active: r.status === "active",
          started: !!r.started,
          notEnded: !!r.not_ended,
          country: !!r.country_ok,
          viewsLeft: max === null || max > views,
          placements: Array.isArray(r.placements) && r.placements.length > 0,
        };
        return {
          id: Number(r.id),
          name: String(r.name),
          advertiser: String(r.advertiser),
          status: String(r.status),
          countries: r.countries,
          placements: r.placements,
          startsAt: r.starts_at,
          endsAt: r.ends_at,
          views,
          maxImpressions: max,
          frequencyCap: r.frequency_cap === null ? null : Number(r.frequency_cap),
          checks,
          served: Object.values(checks).every(Boolean),
        };
      }),
    });
  } catch (e) {
    console.error("delivery check failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
