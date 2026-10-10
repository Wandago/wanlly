import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { loadAffiliates } from "@/lib/affiliates-server";
import { post } from "@/lib/ledger";

/*
 * The partner's confirmation that someone signed up (an S2S "postback"). The partner calls:
 *   /api/offers/postback?offer=<id>&click=<click id>&secret=<secret>[&payout=<usd>]
 * The secret is the offer's own (Admin → Affiliates). Each click pays once: a repeated call is
 * answered "ok" and does nothing. The person gets the offer's credits; the payout is recorded as
 * revenue on the event, which Admin → Money counts.
 */

function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const offer = (await loadAffiliates()).find((a) => a.id === p.get("offer"));
  if (!offer?.secret || !offer.credits || !same(offer.secret, p.get("secret") ?? "")) return new Response("forbidden", { status: 403 });
  const click = (p.get("click") ?? "").slice(0, 64);
  const partner = `offer:${offer.id}`.slice(0, 40);
  try {
    const [started] = await db()
      .select({ userId: schema.adEvents.userId })
      .from(schema.adEvents)
      .where(and(eq(schema.adEvents.partner, partner), eq(schema.adEvents.transactionId, click), eq(schema.adEvents.kind, "reward_started")))
      .limit(1);
    if (!started?.userId) return new Response("unknown click", { status: 404 });
    const payout = Number(p.get("payout"));
    const usd = Number.isFinite(payout) && payout > 0 ? Math.min(payout, 500) : (offer.payoutUsd ?? 0);
    // One completion per click, enforced by the unique (partner, transaction_id) index.
    const done = await db()
      .insert(schema.adEvents)
      .values({ userId: started.userId, partner, format: "offer", placement: "earn_dialog", kind: "reward_completed", creative: `affiliate:${offer.id}`, transactionId: `${click}:done`, revenueMicros: Math.round(usd * 1e6) })
      .onConflictDoNothing()
      .returning({ id: schema.adEvents.id });
    if (done.length) await post(started.userId, offer.credits, "sponsor_trial", `offer:${offer.id}:${click}`, offer.name);
    return new Response("ok");
  } catch (e) {
    console.error("offer postback failed", e);
    return new Response("try again", { status: 503 });
  }
}
