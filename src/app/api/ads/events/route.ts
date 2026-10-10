import { and, eq, gte, sql } from "drizzle-orm";
import { db, rawSql, schema } from "@/db";
import { signedInUserId } from "@/lib/session";

const KINDS = new Set(["impression", "click"]);
const FORMATS = new Set(["native", "display"]);
const PLACEMENTS = new Set(["rail_cover", "rail_banner", "sidebar_card", "phone_banner", "job_card", "job_line", "interstitial", "home_banner", "between_turns", "design_wait", "native_row"]);
/** Above this many events a minute from one account, the rest are dropped. */
const PER_MINUTE = 120;
/** Most views of one sold campaign a person counts for in a day, when the campaign sets no cap. */
const PER_PERSON_DAY = 10;

/** Ad impressions and clicks from the app, sent in small batches. Only from signed-in people. */
export async function POST(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return new Response(null, { status: 401 });
  const text = await req.text();
  if (text.length > 8192) return new Response(null, { status: 413 });
  let list: unknown;
  try {
    list = JSON.parse(text).events;
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!Array.isArray(list)) return new Response(null, { status: 400 });
  const country = req.headers.get("cf-ipcountry");
  let rows = list
    .slice(0, 30)
    .filter((e): e is Record<string, string> => !!e && typeof e === "object")
    .filter((e) => KINDS.has(e.kind) && FORMATS.has(e.format) && PLACEMENTS.has(e.placement) && typeof e.creative === "string")
    .map((e) => ({
      userId,
      // Network banners are counted under the network's name; clicks inside them can't be seen.
      partner: e.creative.startsWith("network:") ? e.creative.slice(8, 38) || "network" : "house",
      kind: e.kind as "impression" | "click",
      format: e.format,
      placement: e.placement,
      creative: e.creative.slice(0, 40),
      country,
    }));
  if (!rows.length) return new Response(null, { status: 204 });
  try {
    // A sold campaign's views are what its advertiser pays for, so one person counts at most as
    // often as the campaign may be shown to them in a day (its cap, or 10), on live campaigns only.
    const ids = [...new Set(rows.filter((r) => r.creative.startsWith("campaign:")).map((r) => Number(r.creative.slice(9))))].filter(Number.isSafeInteger);
    if (ids.length) {
      const live = (await rawSql()`
        select c.id, coalesce((to_jsonb(c)->>'frequency_cap')::int, ${PER_PERSON_DAY}) as cap,
          (select count(*)::int from ad_events a where a.user_id = ${userId} and a.kind = 'impression'
             and a.creative = 'campaign:' || c.id and a.created_at >= date_trunc('day', now())) as seen
        from campaigns c where c.id = any(${ids}) and c.status = 'active'`) as { id: number; cap: number; seen: number }[];
      const room = new Map(live.map((c) => [`campaign:${c.id}`, c.cap - c.seen]));
      rows = rows.filter((r) => {
        if (!r.creative.startsWith("campaign:")) return true;
        const left = room.get(r.creative);
        if (left === undefined) return false;
        if (r.kind === "click") return true;
        room.set(r.creative, left - 1);
        return left > 0;
      });
      if (!rows.length) return new Response(null, { status: 204 });
    }
    const [{ n }] = await db()
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.adEvents)
      .where(and(eq(schema.adEvents.userId, userId), gte(schema.adEvents.createdAt, sql`now() - interval '1 minute'`)));
    if (n + rows.length > PER_MINUTE) return new Response(null, { status: 429 });
    await db().insert(schema.adEvents).values(rows);
  } catch (e) {
    console.error("ad events failed", e);
  }
  return new Response(null, { status: 204 });
}
