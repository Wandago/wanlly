import { asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { CAN, logAction, requireStaff } from "@/lib/admin";
import { field, smallJson } from "@/lib/forms";
import { ensureSupportTables, notifyPerson } from "@/lib/support";

const t = schema.supportTickets;
const m = schema.supportMessages;

async function load(req: Request, ctx: RouteContext<"/api/admin/support/[id]">) {
  const staff = await requireStaff(req, CAN.messages);
  if (staff instanceof Response) return staff;
  const id = Number((await ctx.params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return Response.json({ error: "Not found" }, { status: 404 });
  await ensureSupportTables();
  const [ticket] = await db().select().from(t).where(eq(t.id, id)).limit(1);
  if (!ticket) return Response.json({ error: "Not found" }, { status: 404 });
  return { staff, ticket };
}

export async function GET(req: Request, ctx: RouteContext<"/api/admin/support/[id]">) {
  try {
    const got = await load(req, ctx);
    if (got instanceof Response) return got;
    const messages = await db()
      .select({ id: m.id, fromStaff: m.fromStaff, body: m.body, createdAt: m.createdAt })
      .from(m)
      .where(eq(m.ticketId, got.ticket.id))
      .orderBy(asc(m.createdAt));
    return Response.json({ ticket: got.ticket, messages });
  } catch (e) {
    console.error("admin support ticket GET failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}

/** A staff reply ({ body }), emailed to the person, and/or a status change ({ status }). */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/support/[id]">) {
  try {
    const got = await load(req, ctx);
    if (got instanceof Response) return got;
    const data = await smallJson(req);
    if (!data) return Response.json({ error: "Bad request" }, { status: 400 });
    const body = field(data, "body", 4000);
    const asked = ["open", "answered", "closed"].includes(String(data.status)) ? (data.status as "open" | "answered" | "closed") : null;
    if (!body && !asked) return Response.json({ error: "Write a reply first." }, { status: 400 });
    const d = db();
    if (body) await d.insert(m).values({ ticketId: got.ticket.id, fromStaff: true, authorId: got.staff.id, body });
    const status = asked ?? "answered";
    const [ticket] = await d.update(t).set({ status, updatedAt: sql`now()` }).where(eq(t.id, got.ticket.id)).returning();
    if (body) await notifyPerson({ id: ticket.id, subject: ticket.subject, email: ticket.email, body });
    await logAction(got.staff.id, body ? "support.replied" : `support.${status}`, `ticket:${ticket.id}`).catch(() => {});
    return Response.json({ ticket });
  } catch (e) {
    console.error("admin support ticket POST failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
