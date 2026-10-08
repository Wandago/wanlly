import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

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
