import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, rawSql, schema } from "@/db";

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

/** Whether this person has unlocked today's community floor (UTC day). */
export async function floorUnlockedToday(userId: string): Promise<boolean> {
  const rows = await db()
    .select({ day: schema.dailyFloors.day })
    .from(schema.dailyFloors)
    .where(and(eq(schema.dailyFloors.userId, userId), eq(schema.dailyFloors.day, sql`current_date`)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Takes credits for a job, only if the balance covers it. A per-person lock makes jobs sent at the
 * same moment wait their turn, so they can never spend the same credits twice.
 * Returns the new balance, or null when there weren't enough credits (or the job was already charged).
 */
export async function spend(userId: string, amount: number, refId: string, note: string): Promise<number | null> {
  const q = rawSql();
  const [, rows] = await q.transaction([
    q`select pg_advisory_xact_lock(hashtext(${userId}))`,
    q`with bal as (select coalesce(sum(delta), 0)::int as total from ledger_entries where user_id = ${userId}),
      ins as (
        insert into ledger_entries (user_id, delta, reason, ref_id, note)
        select ${userId}, ${-amount}, 'settle', ${refId}, ${note} from bal where bal.total >= ${amount}
        on conflict (ref_id, reason) do nothing
        returning delta
      )
      select ((select total from bal) + coalesce((select sum(delta) from ins), 0))::int as credits, (select count(*) from ins)::int as charged`,
  ]);
  const row = (rows as Record<string, unknown>[])[0] as { credits: number; charged: number } | undefined;
  return row && row.charged > 0 ? Number(row.credits) : null;
}
