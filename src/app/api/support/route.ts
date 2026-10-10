import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { field, smallJson } from "@/lib/forms";
import { signedInUserId } from "@/lib/session";
import { SUPPORT_CATEGORIES, ensureSupportTables, notifyTeam, type SupportCategory } from "@/lib/support";

const t = schema.supportTickets;
const m = schema.supportMessages;

/** This person's tickets, newest activity first. */
export async function GET(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  try {
    await ensureSupportTables();
    const rows = await db()
      .select({
        id: t.id,
        subject: t.subject,
        category: t.category,
        status: t.status,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        messages: sql<number>`(select count(*)::int from support_messages where ticket_id = ${t.id})`,
      })
      .from(t)
      .where(eq(t.userId, userId))
      .orderBy(desc(t.updatedAt))
      .limit(100);
    return Response.json({ tickets: rows });
  } catch (e) {
    console.error("support GET failed", e);
    return Response.json({ error: "Support is unavailable right now. Try again in a minute." }, { status: 503 });
  }
}

/** Raises a ticket. */
export async function POST(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const data = await smallJson(req);
  if (!data) return Response.json({ error: "Bad request" }, { status: 400 });
  const subject = field(data, "subject", 140);
  const body = field(data, "body", 4000);
  const category = (SUPPORT_CATEGORIES as readonly string[]).includes(String(data.category)) ? (data.category as SupportCategory) : "other";
  const page = field(data, "page", 300) || null;
  if (subject.length < 4) return Response.json({ error: "Add a short title for the issue." }, { status: 400 });
  if (body.length < 10) return Response.json({ error: "Tell us a bit more about what happened." }, { status: 400 });
  try {
    await ensureSupportTables();
    const d = db();
    const [{ n }] = await d
      .select({ n: sql<number>`count(*)::int` })
      .from(t)
      .where(and(eq(t.userId, userId), gte(t.createdAt, sql`now() - interval '1 day'`)));
    if (n >= 8) return Response.json({ error: "You've raised a lot of tickets today. Add to an open one instead." }, { status: 429 });
    const [me] = await d.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    const [ticket] = await d.insert(t).values({ userId, email: me?.email ?? null, subject, category, page }).returning();
    await d.insert(m).values({ ticketId: ticket.id, authorId: userId, body });
    await notifyTeam({ id: ticket.id, subject, category, email: ticket.email, body });
    return Response.json({ ticket });
  } catch (e) {
    console.error("support POST failed", e);
    return Response.json({ error: "Couldn't save your ticket. Try again in a minute." }, { status: 503 });
  }
}
