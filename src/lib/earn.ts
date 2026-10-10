import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { DAILY_VIDEO_CAP, FLOOR_CREDITS, SPOT_REWARD, SPOT_SECONDS } from "./catalog";
import { post } from "./ledger";
import { clerk } from "./session";

/*
 * Rewarded videos, checked on the server. Until a real ad network sends signed callbacks, the
 * server is the only judge of a view: it hands out a one-time view id when the video starts, and
 * pays only if that same person finishes it after the video's full length, once.
 */

/** Our own placeholder spots, until a partner's SDK takes over. */
const PARTNER = "house";
/** A view must be finished within this long of starting. */
const MAX_VIEW_MS = 10 * 60 * 1000;
/** Allows for network delay at the start and end of a view. */
const MIN_VIEW_MS = SPOT_SECONDS * 1000 - 1000;

const PLACEMENTS = new Set(["unlock", "earn_dialog", "gate", "job_card"]);

async function completedToday(userId: string): Promise<number> {
  const [row] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.adEvents)
    .where(and(eq(schema.adEvents.userId, userId), eq(schema.adEvents.kind, "reward_completed"), gte(schema.adEvents.createdAt, sql`date_trunc('day', now())`)));
  return row?.n ?? 0;
}

export const PHONE_NEEDED = "Add and verify your phone number to keep earning today. Your first video each day never needs it.";

/**
 * Whether this person has a verified phone. Our copy can be behind (they may have just added
 * one), so a "no" is checked with Clerk and saved.
 */
async function phoneVerified(userId: string): Promise<boolean> {
  const [row] = await db().select({ ok: schema.users.phoneVerified }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (row?.ok) return true;
  const u = await clerk().users.getUser(userId);
  const ok = u.phoneNumbers.some((p) => p.verification?.status === "verified");
  if (ok) await db().update(schema.users).set({ phoneVerified: true }).where(eq(schema.users.id, userId));
  return ok;
}

export async function startView(userId: string, placement: string, country: string | null) {
  if (!PLACEMENTS.has(placement)) return { error: "Unknown placement", status: 400 } as const;
  const today = await completedToday(userId);
  if (today >= DAILY_VIDEO_CAP) return { error: "You've watched today's limit of videos. More tomorrow.", status: 429 } as const;
  // One phone, one earner: past the first video of the day, a script would need a real phone
  // number per account (Clerk lets a number belong to one account only).
  if (today >= 1 && !(await phoneVerified(userId))) return { error: PHONE_NEEDED, status: 403, need: "phone" } as const;
  // At most four starts a minute: stops one person farming many tabs at once.
  const [recent] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.adEvents)
    .where(and(eq(schema.adEvents.userId, userId), eq(schema.adEvents.kind, "reward_started"), gte(schema.adEvents.createdAt, sql`now() - interval '1 minute'`)));
  if ((recent?.n ?? 0) >= 4) return { error: "Too many videos at once. Finish one first.", status: 429 } as const;

  const viewId = crypto.randomUUID();
  await db().insert(schema.adEvents).values({ userId, partner: PARTNER, format: "video", placement, country, kind: "reward_started", transactionId: viewId });
  return { viewId } as const;
}

export async function completeView(userId: string, viewId: string, country: string | null) {
  const [started] = await db()
    .select({ placement: schema.adEvents.placement, ms: sql<number>`(extract(epoch from now() - ${schema.adEvents.createdAt}) * 1000)::int` })
    .from(schema.adEvents)
    .where(and(eq(schema.adEvents.partner, PARTNER), eq(schema.adEvents.transactionId, viewId), eq(schema.adEvents.userId, userId), eq(schema.adEvents.kind, "reward_started")))
    .limit(1);
  if (!started) return { error: "Unknown video", status: 404 } as const;
  if (started.ms < MIN_VIEW_MS) return { error: "The video wasn't finished", status: 409 } as const;
  if (started.ms > MAX_VIEW_MS) return { error: "That video expired. Start a new one.", status: 410 } as const;
  const today = await completedToday(userId);
  if (today >= DAILY_VIDEO_CAP) return { error: "You've watched today's limit of videos. More tomorrow.", status: 429 } as const;
  // Two views started together before the first finished: the second still needs the phone.
  if (today >= 1 && !(await phoneVerified(userId))) return { error: PHONE_NEEDED, status: 403, need: "phone" } as const;

  // One completion per view, enforced by the unique (partner, transaction_id) index.
  const done = await db()
    .insert(schema.adEvents)
    .values({ userId, partner: PARTNER, format: "video", placement: started.placement, country, kind: "reward_completed", transactionId: `${viewId}:done` })
    .onConflictDoNothing()
    .returning({ id: schema.adEvents.id });
  if (done.length === 0) return { earned: 0, bonus: false } as const;

  // The first finished video of the UTC day claims the bonus; the unique (user, day) row decides races.
  const bonus = await db()
    .insert(schema.dailyFloors)
    .values({ userId, day: sql`current_date`, credits: FLOOR_CREDITS })
    .onConflictDoNothing()
    .returning({ day: schema.dailyFloors.day });
  if (bonus.length > 0) {
    await post(userId, FLOOR_CREDITS, "floor", `floor:${userId}:${bonus[0].day}`, "First video today");
    return { earned: FLOOR_CREDITS, bonus: true } as const;
  }
  await post(userId, SPOT_REWARD, "video", `video:${viewId}`);
  return { earned: SPOT_REWARD, bonus: false } as const;
}
