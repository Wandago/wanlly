import { rawSql } from "@/db";
import { CAN, requireStaff } from "@/lib/admin";
import { adsterraDaily } from "@/lib/adsterra";
import { replyCostUsd } from "@/lib/ai";
import { readEntries } from "@/lib/revenue-log";

const num = (v: unknown) => Number(v ?? 0);

/** Today's numbers and the last 14 days, from the database. */
export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.view);
  if (staff instanceof Response) return staff;
  try {
    const q = rawSql();
    const [totals, days, today] = await Promise.all([
      q`select
          (select count(*) from users where status <> 'deleted')::int as users,
          (select count(*) from users where created_at >= date_trunc('day', now()))::int as new_today,
          (select count(distinct user_id) from ledger_entries where created_at >= date_trunc('day', now()))::int as active_today,
          (select count(*) from ad_events where kind = 'reward_completed' and partner not like 'offer:%' and created_at >= date_trunc('day', now()))::int as videos_today,
          (select coalesce(sum(delta) filter (where delta > 0), 0) from ledger_entries where created_at >= date_trunc('day', now()))::int as earned_today,
          (select coalesce(-sum(delta) filter (where reason in ('settle', 'release')), 0) from ledger_entries where created_at >= date_trunc('day', now()))::int as spent_today,
          (select count(*) from beta_applications where status = 'pending')::int as beta_pending,
          (select count(*) from beta_applications)::int as beta_total,
          (select count(*) from contact_messages where handled_at is null)::int as messages_open,
          (select count(*) from users where status in ('frozen', 'banned'))::int as paused,
          (select count(distinct visitor) from page_views where created_at >= date_trunc('day', now()))::int as visitors_today,
          (select count(*) from page_views where created_at >= date_trunc('day', now()))::int as views_today,
          (select count(*) from ad_events where kind = 'impression' and format = 'native' and created_at >= date_trunc('day', now()))::int as native_today,
          (select count(*) from ad_events where kind = 'impression' and format = 'display' and created_at >= date_trunc('day', now()))::int as display_today`,
      q`with d as (select generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') as day)
        select to_char(d.day, 'YYYY-MM-DD') as day,
          (select count(*) from users u where u.created_at >= d.day and u.created_at < d.day + interval '1 day')::int as signups,
          (select count(distinct l.user_id) from ledger_entries l where l.created_at >= d.day and l.created_at < d.day + interval '1 day')::int as active,
          (select count(*) from ad_events a where a.kind = 'reward_completed' and a.partner not like 'offer:%' and a.created_at >= d.day and a.created_at < d.day + interval '1 day')::int as videos,
          (select coalesce(-sum(l.delta), 0) from ledger_entries l where l.reason in ('settle', 'release') and l.created_at >= d.day and l.created_at < d.day + interval '1 day')::int as spent,
          (select count(*) from beta_applications b where b.created_at >= d.day and b.created_at < d.day + interval '1 day')::int as applications
        from d order by d.day desc`,
      // Real money today: sold campaigns at their price, and model tokens at each model's price.
      q`select to_char(now(), 'YYYY-MM-DD') as day,
          (select coalesce(sum(c.cpm_cents), 0) from ad_events a join campaigns c on a.creative = 'campaign:' || c.id
            where a.kind = 'impression' and a.created_at >= date_trunc('day', now()))::bigint as cpm_cents,
          (select coalesce(sum(revenue_micros), 0) from ad_events where kind = 'reward_completed' and partner like 'offer:%' and created_at >= date_trunc('day', now()))::bigint as offer_micros,
          (select coalesce(json_agg(x), '[]') from (select model_id, sum(input_tokens)::bigint as i, sum(output_tokens)::bigint as o from messages
            where role = 'assistant' and model_id is not null and created_at >= date_trunc('day', now()) group by model_id) x) as usage`,
    ]);
    const td = (today as Record<string, unknown>[])[0] ?? {};
    const day = String(td.day);
    const [network, entries] = await Promise.all([adsterraDaily(day, day), readEntries()]);
    const realRevenue =
      num(td.cpm_cents) / 100 / 1000 + num(td.offer_micros) / 1e6 + (network?.days ?? []).filter((x) => x.day === day).reduce((a, x) => a + x.usd, 0) + entries.filter((e) => e.day === day).reduce((a, e) => a + e.usd, 0);
    const realCost = ((td.usage ?? []) as { model_id: string; i: number; o: number }[]).reduce((a, u) => a + replyCostUsd(u.model_id, num(u.i), num(u.o)), 0);
    const t = (totals as Record<string, unknown>[])[0] ?? {};
    return Response.json({
      role: staff.role,
      totals: {
        users: num(t.users),
        newToday: num(t.new_today),
        activeToday: num(t.active_today),
        videosToday: num(t.videos_today),
        earnedToday: num(t.earned_today),
        spentToday: num(t.spent_today),
        betaPending: num(t.beta_pending),
        betaTotal: num(t.beta_total),
        messagesOpen: num(t.messages_open),
        paused: num(t.paused),
        visitorsToday: num(t.visitors_today),
        viewsToday: num(t.views_today),
        adViewsToday: num(t.native_today) + num(t.display_today),
        revenueToday: realRevenue,
        costToday: realCost,
      },
      days: (days as Record<string, unknown>[]).map((d) => ({ day: String(d.day), signups: num(d.signups), active: num(d.active), videos: num(d.videos), spent: num(d.spent), applications: num(d.applications) })),
    });
  } catch (e) {
    console.error("admin overview failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
