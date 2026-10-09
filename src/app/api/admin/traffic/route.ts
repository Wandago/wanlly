import { rawSql } from "@/db";
import { CAN, rangeDays, requireStaff } from "@/lib/admin";

const rows = (r: unknown) => r as Record<string, unknown>[];
const n = (v: unknown) => Number(v ?? 0);

/** Visitors and page views by day, page, source, country and device. */
export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.view);
  if (staff instanceof Response) return staff;
  const days = rangeDays(req);
  const since = `${days - 1} days`;
  try {
    const q = rawSql();
    const [daily, pages, sources, countries, devices] = await Promise.all([
      q`with d as (select generate_series(date_trunc('day', now()) - ${since}::interval, date_trunc('day', now()), interval '1 day') as day)
        select to_char(d.day, 'YYYY-MM-DD') as day, count(v.id)::int as views, count(distinct v.visitor)::int as visitors
        from d left join page_views v on v.created_at >= d.day and v.created_at < d.day + interval '1 day'
        group by d.day order by d.day`,
      q`select path, count(*)::int as views, count(distinct visitor)::int as visitors
        from page_views where created_at >= date_trunc('day', now()) - ${since}::interval
        group by path order by views desc limit 25`,
      q`select coalesce(utm_source, referrer, 'Direct') as source, count(*)::int as views, count(distinct visitor)::int as visitors
        from page_views where created_at >= date_trunc('day', now()) - ${since}::interval
        group by 1 order by visitors desc limit 15`,
      q`with v as (select coalesce(country, '??') as c, count(distinct visitor)::int as visitors from page_views
          where created_at >= date_trunc('day', now()) - ${since}::interval group by 1),
        s as (select coalesce(country, '??') as c, count(*)::int as signups from users
          where created_at >= date_trunc('day', now()) - ${since}::interval group by 1)
        select v.c as country, v.visitors, coalesce(s.signups, 0)::int as signups from v left join s using (c)
        order by v.visitors desc limit 20`,
      q`select device, count(distinct visitor)::int as visitors from page_views
        where created_at >= date_trunc('day', now()) - ${since}::interval group by device order by visitors desc`,
    ]);
    return Response.json({
      days,
      daily: rows(daily).map((r) => ({ day: String(r.day), views: n(r.views), visitors: n(r.visitors) })),
      pages: rows(pages).map((r) => ({ path: String(r.path), views: n(r.views), visitors: n(r.visitors) })),
      sources: rows(sources).map((r) => ({ source: String(r.source), views: n(r.views), visitors: n(r.visitors) })),
      countries: rows(countries).map((r) => ({ country: String(r.country), visitors: n(r.visitors), signups: n(r.signups) })),
      devices: rows(devices).map((r) => ({ device: String(r.device), visitors: n(r.visitors) })),
    });
  } catch (e) {
    console.error("admin traffic failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
