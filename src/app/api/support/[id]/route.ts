import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { field, smallJson } from "@/lib/forms";
import { signedInUserId } from "@/lib/session";
import { ensureSupportTables, notifyTeam } from "@/lib/support";

const t = schema.supportTickets;
const m = schema.supportMessages;

async function own(req: Request, ctx: RouteContext<"/api/support/[id]">) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return Response.json({ error: "Not found" }, { status: 404 });
  await ensureSupportTables();
  const [ticket] = await db()
    .select()
    .from(t)
    .where(and(eq(t.id, id), eq(t.userId, userId)))
    .limit(1);
  if (!ticket) return Response.json({ error: "Not found" }, { status: 404 });
  return { userId, ticket };
}

/** One ticket and its conversation. */
export async function GET(req: Request, ctx: RouteContext<"/api/support/[id]">) {
  try {
    const got = await own(req, ctx);
    if (got instanceof Response) return got;
    const messages = await db()
      .select({ id: m.id, fromStaff: m.fromStaff, body: m.body, createdAt: m.createdAt })
      .from(m)
      .where(eq(m.ticketId, got.ticket.id))
      .orderBy(asc(m.createdAt));
    return Response.json({ ticket: got.ticket, messages });
  } catch (e) {
    console.error("support ticket GET failed", e);
    return Response.json({ error: "Support is unavailable right now." }, { status: 503 });
  }
}

/** Adds a reply (which reopens the ticket), or closes it with { close: true }. */
export async function POST(req: Request, ctx: RouteContext<"/api/support/[id]">) {
  try {
    const got = await own(req, ctx);
    if (got instanceof Response) return got;
    const data = await smallJson(req);
    if (!data) return Response.json({ error: "Bad request" }, { status: 400 });
    const d = db();
    if (data.close === true) {
      const [ticket] = await d.update(t).set({ status: "closed", updatedAt: sql`now()` }).where(eq(t.id, got.ticket.id)).returning();
      return Response.json({ ticket });
    }
    const body = field(data, "body", 4000);
    if (body.length < 2) return Response.json({ error: "Write a reply first." }, { status: 400 });
    const [{ n }] = await d.select({ n: sql<number>`count(*)::int` }).from(m).where(eq(m.ticketId, got.ticket.id));
    if (n >= 60) return Response.json({ error: "This ticket is very long. Raise a new one." }, { status: 429 });
    await d.insert(m).values({ ticketId: got.ticket.id, authorId: got.userId, body });
    const [ticket] = await d.update(t).set({ status: "open", updatedAt: sql`now()` }).where(eq(t.id, got.ticket.id)).returning();
    await notifyTeam({ id: ticket.id, subject: ticket.subject, category: ticket.category, email: ticket.email, body, reply: true });
    return Response.json({ ticket });
  } catch (e) {
    console.error("support ticket POST failed", e);
    return Response.json({ error: "Couldn't send that. Try again in a minute." }, { status: 503 });
  }
}
