import { db, schema } from "@/db";
import { blockedReason } from "@/lib/admin";
import { loadAffiliates } from "@/lib/affiliates-server";
import { SAY } from "@/lib/messages";
import { signedInUserId } from "@/lib/session";

/**
 * Starts a sponsor offer: records a one-time click id for this person and returns the partner's
 * link carrying it. When the partner confirms the signup (/api/offers/postback), that click id
 * says whose credits they are.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/offers/[id]/click">) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  const blocked = await blockedReason(userId, "earn").catch(() => null);
  if (blocked) return Response.json({ error: blocked }, { status: 403 });
  const id = (await ctx.params).id;
  const offer = (await loadAffiliates()).find((a) => a.id === id && a.active && a.credits);
  if (!offer) return Response.json({ error: SAY.notFound }, { status: 404 });
  const click = crypto.randomUUID().replace(/-/g, "");
  try {
    await db()
      .insert(schema.adEvents)
      .values({ userId, partner: `offer:${offer.id}`.slice(0, 40), format: "offer", placement: "earn_dialog", kind: "reward_started", creative: `affiliate:${offer.id}`, transactionId: click, country: req.headers.get("cf-ipcountry") });
    const url = new URL(offer.url);
    url.searchParams.set(offer.subParam ?? "subid", click);
    return Response.json({ url: url.toString() });
  } catch (e) {
    console.error("offer click failed", e);
    return Response.json({ error: SAY.busy }, { status: 503 });
  }
}
