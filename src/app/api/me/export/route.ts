import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { signedInUserId } from "@/lib/session";

/** Everything Wanlly holds about the signed-in person, as one JSON file. */
export async function GET(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  try {
    const d = db();
    const [user, ledger, projects, conversations] = await Promise.all([
      d.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1),
      d.select().from(schema.ledgerEntries).where(eq(schema.ledgerEntries.userId, userId)).orderBy(desc(schema.ledgerEntries.id)),
      d.select().from(schema.projects).where(eq(schema.projects.ownerId, userId)),
      d.select().from(schema.conversations).where(eq(schema.conversations.userId, userId)),
    ]);
    const ids = conversations.map((c) => c.id);
    const messages = ids.length ? await d.select().from(schema.messages).where(inArray(schema.messages.conversationId, ids)) : [];
    const body = JSON.stringify({ exportedAt: new Date().toISOString(), account: user[0] ?? null, projects, conversations: conversations.map((c) => ({ ...c, messages: messages.filter((m) => m.conversationId === c.id) })), credits: ledger }, null, 2);
    return new Response(body, {
      headers: { "content-type": "application/json", "content-disposition": `attachment; filename="wanlly-data.json"`, "cache-control": "no-store" },
    });
  } catch (e) {
    console.error("export failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
