import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { signedInUserId } from "@/lib/session";

/** The last 100 credits in and out, newest first. */
export async function GET(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  try {
    const rows = await db()
      .select({ delta: schema.ledgerEntries.delta, reason: schema.ledgerEntries.reason, note: schema.ledgerEntries.note, at: schema.ledgerEntries.createdAt })
      .from(schema.ledgerEntries)
      .where(eq(schema.ledgerEntries.userId, userId))
      .orderBy(desc(schema.ledgerEntries.id))
      .limit(100);
    return Response.json({ entries: rows });
  } catch (e) {
    console.error("ledger GET failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
