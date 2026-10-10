import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, rawSql, schema } from "@/db";
import { DAILY_SPEND_LIMIT, DAILY_VIDEO_CAP, WEEKLY_SPEND_LIMIT, WEEKLY_SPEND_LIMIT_VERIFIED, type Usage } from "./catalog";
import { rewardNow } from "./reward";

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

export type Account = { credits: number; floorUnlocked: boolean; usage: Usage };

/** Before migration 0011 adds the session columns, limits fall back to UTC days and Monday weeks. */
const noSessionColumns = (e: unknown) => /session_started_at|week_started_at/.test(`${e} ${(e as { cause?: unknown }).cause}`);

/** Balance, today's bonus and usage in this person's current session and week, in one round trip. */
export async function account(userId: string): Promise<Account> {
  const q = rawSql();
  let rows: Record<string, unknown>[];
  try {
    rows = (await q`
      with u as (
        select
          case when session_started_at + interval '6 hours' > now() then session_started_at end as ss,
          case when week_started_at + interval '7 days' > now() then week_started_at end as ws
        from users where id = ${userId}
      )
      select
        coalesce(sum(delta), 0)::int as credits,
        coalesce(-sum(delta) filter (where reason in ('settle', 'release') and created_at >= (select ss from u)), 0)::int as day_used,
        coalesce(-sum(delta) filter (where reason in ('settle', 'release') and created_at >= (select ws from u)), 0)::int as week_used,
        (select ss + interval '6 hours' from u) as day_resets,
        (select ws + interval '7 days' from u) as week_resets,
        (select count(*) from ad_events where user_id = ${userId} and kind = 'reward_completed' and partner not like 'offer:%' and created_at >= date_trunc('day', now()))::int as videos,
        exists (select 1 from daily_floors where user_id = ${userId} and day = current_date) as floor,
        coalesce((select phone_verified from users where id = ${userId}), false) as verified
      from ledger_entries where user_id = ${userId}`) as Record<string, unknown>[];
  } catch (e) {
    if (!noSessionColumns(e)) throw e;
    rows = (await q`
      select
        coalesce(sum(delta), 0)::int as credits,
        coalesce(-sum(delta) filter (where reason in ('settle', 'release') and created_at >= date_trunc('day', now())), 0)::int as day_used,
        coalesce(-sum(delta) filter (where reason in ('settle', 'release') and created_at >= date_trunc('week', now())), 0)::int as week_used,
        date_trunc('day', now()) + interval '1 day' as day_resets,
        date_trunc('week', now()) + interval '7 days' as week_resets,
        (select count(*) from ad_events where user_id = ${userId} and kind = 'reward_completed' and partner not like 'offer:%' and created_at >= date_trunc('day', now()))::int as videos,
        exists (select 1 from daily_floors where user_id = ${userId} and day = current_date) as floor,
        coalesce((select phone_verified from users where id = ${userId}), false) as verified
      from ledger_entries where user_id = ${userId}`) as Record<string, unknown>[];
  }
  const r = rows[0] ?? {};
  const reward = await rewardNow().catch(() => null);
  const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
  return {
    credits: Number(r.credits ?? 0),
    floorUnlocked: Boolean(r.floor),
    usage: {
      dayUsed: Number(r.day_used ?? 0),
      dayLimit: DAILY_SPEND_LIMIT,
      weekUsed: Number(r.week_used ?? 0),
      weekLimit: r.verified ? WEEKLY_SPEND_LIMIT_VERIFIED : WEEKLY_SPEND_LIMIT,
      verified: Boolean(r.verified),
      reward: reward?.perAd,
      floorBonus: reward?.floor,
      videos: Number(r.videos ?? 0),
      videoCap: DAILY_VIDEO_CAP,
      dayResetsAt: iso(r.day_resets),
      weekResetsAt: iso(r.week_resets),
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
  let rows: unknown;
  try {
    // A session (6 hours) and a week (7 days) start with the first spend after the last one ended.
    [, rows] = await q.transaction([
      q`select pg_advisory_xact_lock(hashtext(${userId}))`,
      q`with u as (
          select
            case when session_started_at is null or session_started_at + interval '6 hours' <= now() then now() else session_started_at end as ss,
            case when week_started_at is null or week_started_at + interval '7 days' <= now() then now() else week_started_at end as ws,
            case when phone_verified then ${WEEKLY_SPEND_LIMIT_VERIFIED}::int else ${WEEKLY_SPEND_LIMIT}::int end as wl
          from users where id = ${userId}
        ),
        cur as (
          select
            coalesce(sum(delta), 0)::int as total,
            coalesce(-sum(delta) filter (where reason in ('settle', 'release') and created_at >= (select ss from u)), 0)::int as day,
            coalesce(-sum(delta) filter (where reason in ('settle', 'release') and created_at >= (select ws from u)), 0)::int as week
          from ledger_entries where user_id = ${userId}
        ),
        ins as (
          insert into ledger_entries (user_id, delta, reason, ref_id, note)
          select ${userId}, ${-amount}, 'settle', ${refId}, ${note} from cur
          where cur.total >= ${amount} and cur.day + ${amount} <= ${DAILY_SPEND_LIMIT} and cur.week + ${amount} <= (select wl from u)
          on conflict (ref_id, reason) do nothing
          returning delta
        ),
        started as (
          update users set session_started_at = (select ss from u), week_started_at = (select ws from u)
          where id = ${userId} and exists (select 1 from ins)
          returning 1
        )
        select cur.total, cur.day, cur.week, (select wl from u) as wl, (select count(*) from ins)::int as charged, (select count(*) from started)::int as started from cur`,
    ]);
  } catch (e) {
    if (!noSessionColumns(e)) throw e;
    [, rows] = await q.transaction([
      q`select pg_advisory_xact_lock(hashtext(${userId}))`,
      q`with cur as (
          select
            coalesce(sum(delta), 0)::int as total,
            coalesce(-sum(delta) filter (where reason in ('settle', 'release') and created_at >= date_trunc('day', now())), 0)::int as day,
            coalesce(-sum(delta) filter (where reason in ('settle', 'release') and created_at >= date_trunc('week', now())), 0)::int as week
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
  }
  const r = (rows as Record<string, unknown>[])[0] ?? {};
  if (Number(r.charged) > 0) return { ok: true };
  if (Number(r.total) < amount) return { ok: false, reason: "credits" };
  if (Number(r.day) + amount > DAILY_SPEND_LIMIT) return { ok: false, reason: "day" };
  if (Number(r.week) + amount > Number(r.wl ?? WEEKLY_SPEND_LIMIT)) return { ok: false, reason: "week" };
  return { ok: false, reason: "duplicate" };
}

/**
 * Charges what a long reply cost beyond its upfront price, but never below a zero balance: if
 * the person can't cover all of it, Wanlly absorbs the rest. Returns the credits actually taken.
 */
export async function chargeExtra(userId: string, amount: number, refId: string, note: string): Promise<number> {
  if (amount <= 0) return 0;
  const q = rawSql();
  const [, rows] = await q.transaction([
    q`select pg_advisory_xact_lock(hashtext(${userId}))`,
    q`with bal as (select coalesce(sum(delta), 0)::int as total from ledger_entries where user_id = ${userId}),
      ins as (
        insert into ledger_entries (user_id, delta, reason, ref_id, note)
        select ${userId}, -least(${amount}, bal.total), 'settle', ${refId}, ${note} from bal where bal.total > 0
        on conflict (ref_id, reason) do nothing
        returning delta
      )
      select coalesce(-(select sum(delta) from ins), 0)::int as taken`,
  ]);
  return Number((rows as Record<string, unknown>[])[0]?.taken ?? 0);
}

/** Gives back the upfront price of a reply that failed before any of it arrived. */
export async function release(userId: string, amount: number, refId: string): Promise<void> {
  await post(userId, amount, "release", refId, "Refund: the reply didn't arrive");
}
