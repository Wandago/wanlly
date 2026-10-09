import { rawSql } from "@/db";
import { CAN, FLAGS, requireStaff } from "@/lib/admin";
import { DAILY_VIDEO_CAP, SPOT_SECONDS } from "@/lib/catalog";

const rows = (r: unknown) => r as Record<string, unknown>[];

/*
 * Rules over the last 7 days that point at farming or multi-accounting. They only flag; a person
 * decides, from the People tab, whether to slow, freeze or ban.
 */
export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.view);
  if (staff instanceof Response) return staff;
  const fastMs = SPOT_SECONDS * 1000 + 1500;
  try {
    const q = rawSql();
    const [shared, capped, abandoned, hopping, newHeavy, fast, flags, log] = await Promise.all([
      // Several accounts on one browser and network on the same day.
      q`select d.visitor, array_agg(distinct d.user_id) as users from user_devices d
        where d.seen_at >= now() - interval '7 days'
        group by d.visitor having count(distinct d.user_id) >= 3 order by count(distinct d.user_id) desc limit 20`,
      // Hit the daily video limit on two or more days.
      q`select user_id, count(*)::int as days from (
          select user_id, date_trunc('day', created_at) as day from ad_events
          where kind = 'reward_completed' and created_at >= now() - interval '7 days'
          group by 1, 2 having count(*) >= ${DAILY_VIDEO_CAP}
        ) t group by user_id having count(*) >= 2`,
      // Starts many videos but finishes few: often many tabs at once.
      q`select user_id, count(*) filter (where kind = 'reward_started')::int as started, count(*) filter (where kind = 'reward_completed')::int as completed
        from ad_events where kind in ('reward_started', 'reward_completed') and created_at >= now() - interval '7 days'
        group by user_id
        having count(*) filter (where kind = 'reward_started') >= 15
          and count(*) filter (where kind = 'reward_completed') < 0.3 * count(*) filter (where kind = 'reward_started')`,
      // Ads from three or more countries in a week: VPNs or shared accounts.
      q`select user_id, array_agg(distinct country) as countries from ad_events
        where created_at >= now() - interval '7 days' and country is not null and user_id is not null
        group by user_id having count(distinct country) >= 3`,
      // New accounts that earned a lot straight away.
      q`select u.id as user_id, sum(l.delta)::int as earned from users u join ledger_entries l on l.user_id = u.id
        where u.created_at >= now() - interval '48 hours' and l.delta > 0
        group by u.id having sum(l.delta) >= 80`,
      // Finishes videos at almost exactly the shortest allowed time, every time: scripted.
      q`select s.user_id, count(*)::int as videos, avg(extract(epoch from c.created_at - s.created_at) * 1000)::int as avg_ms
        from ad_events s join ad_events c on c.partner = s.partner and c.transaction_id = s.transaction_id || ':done'
        where s.kind = 'reward_started' and s.created_at >= now() - interval '7 days'
        group by s.user_id
        having count(*) >= 10 and avg(extract(epoch from c.created_at - s.created_at) * 1000) < ${fastMs}
          and stddev_samp(extract(epoch from c.created_at - s.created_at) * 1000) < 400`,
      q`select key, value, updated_at from app_flags`,
      q`select a.actor_id, u.email as actor, a.action, a.target, a.detail, a.created_at from admin_actions a
        left join users u on u.id = a.actor_id order by a.id desc limit 30`,
    ]);

    type Flag = { userId: string; rule: string; detail: string };
    const out: Flag[] = [];
    for (const r of rows(shared)) for (const u of r.users as string[]) out.push({ userId: u, rule: "Shared device", detail: `${(r.users as string[]).length} accounts on one browser and network` });
    for (const r of rows(capped)) out.push({ userId: String(r.user_id), rule: "Video limit, often", detail: `Hit the ${DAILY_VIDEO_CAP}-video limit on ${r.days} days` });
    for (const r of rows(abandoned)) out.push({ userId: String(r.user_id), rule: "Abandoned videos", detail: `Finished ${r.completed} of ${r.started} started` });
    for (const r of rows(hopping)) out.push({ userId: String(r.user_id), rule: "Country hopping", detail: (r.countries as string[]).join(", ") });
    for (const r of rows(newHeavy)) out.push({ userId: String(r.user_id), rule: "New and earning fast", detail: `${r.earned} credits in the first two days` });
    for (const r of rows(fast)) out.push({ userId: String(r.user_id), rule: "Scripted timing", detail: `${r.videos} videos finished in ${(Number(r.avg_ms) / 1000).toFixed(1)}s on average, almost no variation` });

    const ids = [...new Set(out.map((f) => f.userId))];
    const people = ids.length
      ? rows(await q`select id, email, status, created_at from users where id = any(${ids})`)
      : [];
    const byId = new Map(people.map((p) => [String(p.id), p]));
    const flagValues = new Map(rows(flags).map((f) => [String(f.key), f.value === true]));

    return Response.json({
      flags: out.map((f) => ({ ...f, email: byId.get(f.userId)?.email ?? null, status: byId.get(f.userId)?.status ?? "unknown" })),
      switches: (Object.keys(FLAGS) as (keyof typeof FLAGS)[]).map((key) => ({ key, on: flagValues.get(key) ?? false })),
      canSwitch: (CAN.switches as readonly string[]).includes(staff.role),
      log: rows(log).map((r) => ({ actor: r.actor ?? r.actor_id, action: r.action, target: r.target, detail: r.detail, at: r.created_at })),
    });
  } catch (e) {
    console.error("admin abuse failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
