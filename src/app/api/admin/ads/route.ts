import { rawSql } from "@/db";
import { CAN, rangeDays, requireStaff } from "@/lib/admin";
import { ESTIMATE } from "@/lib/catalog";

const rows = (r: unknown) => r as Record<string, unknown>[];
const n = (v: unknown) => Number(v ?? 0);

/** Revenue estimated from viewable impressions and finished videos at the planning eCPMs. */
function estimate(format: string, impressions: number, videos: number) {
  const cpm = format === "native" ? ESTIMATE.ecpm.native : ESTIMATE.ecpm.display;
  return (impressions / 1000) * cpm + (videos / 1000) * ESTIMATE.ecpm.rewarded;
}

/** Ad performance by day, placement and creative, with estimated revenue and model cost. */
export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.view);
  if (staff instanceof Response) return staff;
  const days = rangeDays(req);
  const since = `${days - 1} days`;
  try {
    const q = rawSql();
    const [daily, placements, creatives, real] = await Promise.all([
      q`with d as (select generate_series(date_trunc('day', now()) - ${since}::interval, date_trunc('day', now()), interval '1 day') as day)
        select to_char(d.day, 'YYYY-MM-DD') as day,
          (select count(*) from ad_events a where a.kind = 'impression' and a.format = 'native' and a.created_at >= d.day and a.created_at < d.day + interval '1 day')::int as native,
          (select count(*) from ad_events a where a.kind = 'impression' and a.format = 'display' and a.created_at >= d.day and a.created_at < d.day + interval '1 day')::int as display,
          (select count(*) from ad_events a where a.kind = 'click' and a.created_at >= d.day and a.created_at < d.day + interval '1 day')::int as clicks,
          (select count(*) from ad_events a where a.kind = 'reward_completed' and a.created_at >= d.day and a.created_at < d.day + interval '1 day')::int as videos,
          (select coalesce(-sum(l.delta), 0) from ledger_entries l where l.reason in ('settle', 'release') and l.created_at >= d.day and l.created_at < d.day + interval '1 day')::int as spent
        from d order by d.day`,
      q`select placement, format,
          count(*) filter (where kind = 'impression')::int as impressions,
          count(*) filter (where kind = 'click')::int as clicks,
          count(*) filter (where kind = 'reward_started')::int as started,
          count(*) filter (where kind = 'reward_completed')::int as completed
        from ad_events where created_at >= date_trunc('day', now()) - ${since}::interval
        group by placement, format order by impressions desc, completed desc`,
      q`select coalesce(creative, 'Video spot') as creative,
          count(*) filter (where kind = 'impression')::int as impressions,
          count(*) filter (where kind = 'click')::int as clicks
        from ad_events where kind in ('impression', 'click') and created_at >= date_trunc('day', now()) - ${since}::interval
        group by 1 order by impressions desc limit 20`,
      q`select coalesce(sum(revenue_micros), 0)::bigint as micros from ad_events where created_at >= date_trunc('day', now()) - ${since}::interval`,
    ]);
    const dailyOut = rows(daily).map((r) => {
      const native = n(r.native);
      const display = n(r.display);
      const videos = n(r.videos);
      const revenue = estimate("native", native, 0) + estimate("display", display, videos);
      return { day: String(r.day), impressions: native + display, clicks: n(r.clicks), videos, revenue, cost: n(r.spent) * ESTIMATE.usdPerCredit };
    });
    return Response.json({
      days,
      assumptions: ESTIMATE,
      reportedRevenue: n(rows(real)[0]?.micros) / 1e6,
      daily: dailyOut,
      placements: rows(placements).map((r) => {
        const impressions = n(r.impressions);
        const completed = n(r.completed);
        return {
          placement: String(r.placement),
          format: String(r.format),
          impressions,
          clicks: n(r.clicks),
          started: n(r.started),
          completed,
          revenue: estimate(String(r.format), impressions, completed),
        };
      }),
      creatives: rows(creatives).map((r) => ({ creative: String(r.creative), impressions: n(r.impressions), clicks: n(r.clicks) })),
    });
  } catch (e) {
    console.error("admin ads failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
