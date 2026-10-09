import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, rawSql, schema } from "@/db";
import { DAILY_SPEND_LIMIT, DAILY_VIDEO_CAP, WEEKLY_SPEND_LIMIT, type Usage } from "./catalog";

type Reason = (typeof schema.ledgerEntries.$inferInsert)["reason"];

/** A person's balance: the sum of their ledger entries. */
export async function balance(userId: string): Promise<number> {
  const [row] = await db()
    .select({ total: sql<number>`coalesce(sum(${schema.ledgerEntries.delta}), 0)::int` })
    .from(schema.ledgerEntries)
    .where(eq(schema.ledgerEntries.userId, userId));
  return row?.total ?? 0;
}

/**
 * Adds one ledger entry. `refId` makes it idempotent: posting the same event twice
 * (a replayed ad callback, a retried request) leaves the ledger unchanged.
 * Returns false when the entry already existed.
 */
export async function post(userId: string, delta: number, reason: Reason, refId: string, note?: string): Promise<boolean> {
  const rows = await db()
    .insert(schema.ledgerEntries)
    .values({ userId, delta, reason, refId, note })
    .onConflictDoNothing({ target: [schema.ledgerEntries.refId, schema.ledgerEntries.reason] })
    .returning({ id: schema.ledgerEntries.id });
  return rows.length > 0;
}

function nextResets(now = new Date()) {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const daysToMonday = (8 - now.getUTCDay()) % 7 || 7;
  const week = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysToMonday));
  return { dayResetsAt: day.toISOString(), weekResetsAt: week.toISOString() };
}

export type Account = { credits: number; floorUnlocked: boolean; usage: Usage };

/** Balance, today's bonus and usage against the limits, in one round trip. */
export async function account(userId: string): Promise<Account> {
  const q = rawSql();
  const rows = (await q`
    select
      coalesce(sum(delta), 0)::int as credits,
      coalesce(-sum(delta) filter (where reason = 'settle' and created_at >= date_trunc('day', now())), 0)::int as day_used,
      coalesce(-sum(delta) filter (where reason = 'settle' and created_at >= date_trunc('week', now())), 0)::int as week_used,
      (select count(*) from ad_events where user_id = ${userId} and kind = 'reward_completed' and created_at >= date_trunc('day', now()))::int as videos,
      exists (select 1 from daily_floors where user_id = ${userId} and day = current_date) as floor
    from ledger_entries where user_id = ${userId}`) as Record<string, unknown>[];
  const r = rows[0] ?? {};
  return {
    credits: Number(r.credits ?? 0),
    floorUnlocked: Boolean(r.floor),
    usage: {
      dayUsed: Number(r.day_used ?? 0),
      dayLimit: DAILY_SPEND_LIMIT,
      weekUsed: Number(r.week_used ?? 0),
      weekLimit: WEEKLY_SPEND_LIMIT,
      videos: Number(r.videos ?? 0),
      videoCap: DAILY_VIDEO_CAP,
      ...nextResets(),
    },
  };
}

export type SpendResult = { ok: true } | { ok: false; reason: "credits" | "day" | "week" | "duplicate" };

/**
 * Takes credits for a job, only if the balance covers it and it stays within the daily and weekly
 * limits. A per-person lock makes jobs sent at the same moment wait their turn, so they can never
 * spend the same credits, or the same limit, twice.
 */
export async function spend(userId: string, amount: number, refId: string, note: string): Promise<SpendResult> {
  const q = rawSql();
  const [, rows] = await q.transaction([
    q`select pg_advisory_xact_lock(hashtext(${userId}))`,
    q`with cur as (
        select
          coalesce(sum(delta), 0)::int as total,
          coalesce(-sum(delta) filter (where reason = 'settle' and created_at >= date_trunc('day', now())), 0)::int as day,
          coalesce(-sum(delta) filter (where reason = 'settle' and created_at >= date_trunc('week', now())), 0)::int as week
        from ledger_entries where user_id = ${userId}
      ),
      ins as (
        insert into ledger_entries (user_id, delta, reason, ref_id, note)
        select ${userId}, ${-amount}, 'settle', ${refId}, ${note} from cur
        where cur.total >= ${amount} and cur.day + ${amount} <= ${DAILY_SPEND_LIMIT} and cur.week + ${amount} <= ${WEEKLY_SPEND_LIMIT}
        on conflict (ref_id, reason) do nothing
        returning delta
      )
      select cur.total, cur.day, cur.week, (select count(*) from ins)::int as charged from cur`,
  ]);
  const r = (rows as Record<string, unknown>[])[0] ?? {};
  if (Number(r.charged) > 0) return { ok: true };
  if (Number(r.total) < amount) return { ok: false, reason: "credits" };
  if (Number(r.day) + amount > DAILY_SPEND_LIMIT) return { ok: false, reason: "day" };
  if (Number(r.week) + amount > WEEKLY_SPEND_LIMIT) return { ok: false, reason: "week" };
  return { ok: false, reason: "duplicate" };
}
