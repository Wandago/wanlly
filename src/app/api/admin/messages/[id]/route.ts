import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { CAN, logAction, requireStaff } from "@/lib/admin";
import { smallJson } from "@/lib/forms";

const m = schema.contactMessages;

/** Marks a message handled, or opens it again. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/messages/[id]">) {
  const staff = await requireStaff(req, CAN.messages);
  if (staff instanceof Response) return staff;
  const id = Number((await ctx.params).id);
  const data = await smallJson(req);
  if (!Number.isSafeInteger(id) || id <= 0 || typeof data?.handled !== "boolean") return Response.json({ error: "Bad request" }, { status: 400 });
  try {
    const [row] = await db()
      .update(m)
      .set({ handledAt: data.handled ? sql`now()` : null })
      .where(eq(m.id, id))
      .returning();
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    await logAction(staff.id, data.handled ? "message.handled" : "message.reopened", `message:${id}`);
    return Response.json({ message: row });
  } catch (e) {
    console.error("admin messages PATCH failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
