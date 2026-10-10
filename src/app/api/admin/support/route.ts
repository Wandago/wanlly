import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { CAN, requireStaff } from "@/lib/admin";
import { ensureSupportTables } from "@/lib/support";

const t = schema.supportTickets;

/** Tickets for the team: open ones (waiting on staff) by default. */
export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.messages);
  if (staff instanceof Response) return staff;
  const show = new URL(req.url).searchParams.get("show") ?? "open";
  try {
    await ensureSupportTables();
    const rows = await db()
      .select({
        id: t.id,
        userId: t.userId,
        email: t.email,
        subject: t.subject,
        category: t.category,
        status: t.status,
        page: t.page,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        messages: sql<number>`(select count(*)::int from support_messages where ticket_id = ${t.id})`,
        last: sql<string>`(select body from support_messages where ticket_id = ${t.id} order by created_at desc limit 1)`,
      })
      .from(t)
      .where(show === "answered" || show === "closed" || show === "open" ? eq(t.status, show) : undefined)
      .orderBy(desc(t.updatedAt))
      .limit(200);
    const [{ open }] = await db()
      .select({ open: sql<number>`count(*)::int` })
      .from(t)
      .where(eq(t.status, "open"));
    return Response.json({ tickets: rows, open });
  } catch (e) {
    console.error("admin support GET failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
