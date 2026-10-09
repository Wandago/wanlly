import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { signedInUserId } from "@/lib/session";

const c = schema.conversations;
const m = schema.messages;

function idOf(raw: string) {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** One conversation with its messages, if it belongs to the signed-in person. */
export async function GET(req: Request, ctx: RouteContext<"/api/conversations/[id]">) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const id = idOf((await ctx.params).id);
  if (!id) return Response.json({ error: "Bad request" }, { status: 400 });
  try {
    const [convo] = await db().select({ id: c.id, title: c.title, tool: c.tool, projectId: c.projectId }).from(c).where(and(eq(c.id, id), eq(c.userId, userId))).limit(1);
    if (!convo) return Response.json({ error: "Not found" }, { status: 404 });
    const rows = await db()
      .select({ id: m.id, role: m.role, content: m.content, modelId: m.modelId, credits: m.credits, createdAt: m.createdAt })
      .from(m)
      .where(eq(m.conversationId, id))
      .orderBy(asc(m.id))
      .limit(200);
    return Response.json({
      conversation: convo,
      messages: rows.map((r) => ({ id: r.id, role: r.role, text: String((r.content as { text?: string })?.text ?? ""), stop: (r.content as { stop?: string })?.stop ?? null, modelId: r.modelId, credits: r.credits, createdAt: r.createdAt })),
    });
  } catch (e) {
    console.error("conversation GET failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}

/** Deletes a conversation and its messages for good. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/conversations/[id]">) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const id = idOf((await ctx.params).id);
  if (!id) return Response.json({ error: "Bad request" }, { status: 400 });
  try {
    const [convo] = await db().select({ id: c.id }).from(c).where(and(eq(c.id, id), eq(c.userId, userId))).limit(1);
    if (!convo) return Response.json({ error: "Not found" }, { status: 404 });
    await db().delete(m).where(eq(m.conversationId, id));
    await db().delete(c).where(eq(c.id, id));
    return Response.json({ ok: true });
  } catch (e) {
    console.error("conversation DELETE failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
