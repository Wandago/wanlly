import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { FLOOR_CREDITS, SPOT_REWARD, SPOT_SECONDS } from "./catalog";
import { post } from "./ledger";

/*
 * Rewarded videos, checked on the server. Until a real ad network sends signed callbacks, the
 * server is the only judge of a view: it hands out a one-time view id when the video starts, and
 * pays only if that same person finishes it after the video's full length, once.
 */

/** Our own placeholder spots, until a partner's SDK takes over. */
const PARTNER = "house";
/** Most completed videos a person can be paid for in one UTC day. */
export const DAILY_VIDEO_CAP = 30;
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

export async function startView(userId: string, placement: string, country: string | null) {
  if (!PLACEMENTS.has(placement)) return { error: "Unknown placement", status: 400 } as const;
  if ((await completedToday(userId)) >= DAILY_VIDEO_CAP) return { error: "That's today's limit. Come back tomorrow.", status: 429 } as const;
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
  if ((await completedToday(userId)) >= DAILY_VIDEO_CAP) return { error: "That's today's limit. Come back tomorrow.", status: 429 } as const;

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
