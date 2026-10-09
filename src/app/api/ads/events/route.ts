import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { signedInUserId } from "@/lib/session";

const KINDS = new Set(["impression", "click"]);
const FORMATS = new Set(["native", "display"]);
const PLACEMENTS = new Set(["rail_cover", "rail_banner", "sidebar_card", "phone_banner", "job_card", "job_line", "interstitial", "home_banner", "between_turns", "design_wait"]);
/** Above this many events a minute from one account, the rest are dropped. */
const PER_MINUTE = 120;

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
  const rows = list
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
