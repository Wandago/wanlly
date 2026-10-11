import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { cpxMaxCredits, cpxReady, cpxSigned } from "@/lib/cpx";
import { post } from "@/lib/ledger";

/*
 * CPX Research's confirmation that someone finished a survey (its "postback"). Set this as the
 * Postback URL in CPX → App → Postback settings:
 *
 *   https://wanlly.africa/api/surveys/cpx?status={status}&trans_id={trans_id}&user_id={user_id}&amount_local={amount_local}&amount_usd={amount_usd}&type={type}&hash={secure_hash}
 *
 * status 1 pays the survey's credits; status 2 means CPX took it back (fraud or a failed quality
 * check), so the same credits come off. Each transaction pays and reverses at most once.
 */
export async function GET(req: Request) {
  if (!cpxReady()) return new Response("not set up", { status: 404 });
  const p = new URL(req.url).searchParams;
  const trans = (p.get("trans_id") ?? "").slice(0, 64);
  if (!trans || !cpxSigned(trans, p.get("hash") ?? "")) return new Response("forbidden", { status: 403 });
  const userId = (p.get("user_id") ?? "").slice(0, 64);
  const credits = Math.min(cpxMaxCredits(), Math.round(Number(p.get("amount_local"))));
  const usd = Math.max(0, Math.min(100, Number(p.get("amount_usd")) || 0));
  const status = p.get("status");
  if (!userId || !(credits > 0) || (status !== "1" && status !== "2")) return new Response("ok");
  try {
    const [user] = await db().select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (!user) return new Response("unknown user", { status: 404 });
    const done = status === "1";
    await db()
      .insert(schema.adEvents)
      .values({ userId, partner: "cpx", format: "survey", placement: "earn_dialog", kind: done ? "reward_completed" : "reward_reversed", creative: `cpx:${p.get("type") ?? "survey"}`.slice(0, 60), transactionId: `${trans}:${done ? "done" : "back"}`, revenueMicros: Math.round((done ? usd : -usd) * 1e6) })
      .onConflictDoNothing();
    if (done) await post(userId, credits, "survey", `cpx:${trans}`, "Survey (CPX Research)");
    else {
      // Only take back what was paid: a reversal for a survey never credited does nothing.
      const [paid] = await db()
        .select({ delta: schema.ledgerEntries.delta })
        .from(schema.ledgerEntries)
        .where(and(eq(schema.ledgerEntries.refId, `cpx:${trans}`), eq(schema.ledgerEntries.reason, "survey")))
        .limit(1);
      if (paid) await post(userId, -paid.delta, "reversal", `cpx:${trans}`, "Survey taken back by CPX Research");
    }
    return new Response("ok");
  } catch (e) {
    console.error("cpx postback failed", e);
    return new Response("try again", { status: 503 });
  }
}
