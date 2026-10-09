import { rawSql } from "@/db";
import { CAN, requireStaff } from "@/lib/admin";

/** Newest 100 accounts, or those whose email, name or id contains `q`. */
export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.view);
  if (staff instanceof Response) return staff;
  const term = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  try {
    const q = rawSql();
    const rows = await q`
      select u.id, u.email, u.name, u.country, u.role, u.status, u.created_at,
        coalesce(sum(l.delta), 0)::int as credits,
        coalesce(-sum(l.delta) filter (where l.reason = 'settle' and l.created_at >= date_trunc('day', now())), 0)::int as spent_today,
        max(l.created_at) as last_active
      from users u left join ledger_entries l on l.user_id = u.id
      where ${term} = '' or u.email ilike ${like} or u.name ilike ${like} or u.id = ${term}
      group by u.id
      order by u.created_at desc
      limit 100`;
    return Response.json({
      canEdit: (CAN.users as readonly string[]).includes(staff.role),
      me: staff.id,
      users: (rows as Record<string, unknown>[]).map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        country: r.country,
        role: r.role,
        status: r.status,
        createdAt: r.created_at,
        credits: Number(r.credits),
        spentToday: Number(r.spent_today),
        lastActive: r.last_active,
      })),
    });
  } catch (e) {
    console.error("admin users GET failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
