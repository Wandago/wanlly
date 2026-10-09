import { rawSql } from "@/db";
import { CAN, requireStaff } from "@/lib/admin";

const num = (v: unknown) => Number(v ?? 0);

/** Today's numbers and the last 14 days, from the database. */
export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.view);
  if (staff instanceof Response) return staff;
  try {
    const q = rawSql();
    const [totals, days] = await Promise.all([
      q`select
          (select count(*) from users where status <> 'deleted')::int as users,
          (select count(*) from users where created_at >= date_trunc('day', now()))::int as new_today,
          (select count(distinct user_id) from ledger_entries where created_at >= date_trunc('day', now()))::int as active_today,
          (select count(*) from ad_events where kind = 'reward_completed' and created_at >= date_trunc('day', now()))::int as videos_today,
          (select coalesce(sum(delta) filter (where delta > 0), 0) from ledger_entries where created_at >= date_trunc('day', now()))::int as earned_today,
          (select coalesce(-sum(delta) filter (where reason = 'settle'), 0) from ledger_entries where created_at >= date_trunc('day', now()))::int as spent_today,
          (select count(*) from beta_applications where status = 'pending')::int as beta_pending,
          (select count(*) from beta_applications)::int as beta_total,
          (select count(*) from contact_messages where handled_at is null)::int as messages_open,
          (select count(*) from users where status in ('frozen', 'banned'))::int as paused`,
      q`with d as (select generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') as day)
        select to_char(d.day, 'YYYY-MM-DD') as day,
          (select count(*) from users u where u.created_at >= d.day and u.created_at < d.day + interval '1 day')::int as signups,
          (select count(distinct l.user_id) from ledger_entries l where l.created_at >= d.day and l.created_at < d.day + interval '1 day')::int as active,
          (select count(*) from ad_events a where a.kind = 'reward_completed' and a.created_at >= d.day and a.created_at < d.day + interval '1 day')::int as videos,
          (select coalesce(-sum(l.delta), 0) from ledger_entries l where l.reason = 'settle' and l.created_at >= d.day and l.created_at < d.day + interval '1 day')::int as spent,
          (select count(*) from beta_applications b where b.created_at >= d.day and b.created_at < d.day + interval '1 day')::int as applications
        from d order by d.day desc`,
    ]);
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
      },
      days: (days as Record<string, unknown>[]).map((d) => ({ day: String(d.day), signups: num(d.signups), active: num(d.active), videos: num(d.videos), spent: num(d.spent), applications: num(d.applications) })),
    });
  } catch (e) {
    console.error("admin overview failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
