import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { CAN, logAction, requireStaff } from "@/lib/admin";
import { smallJson } from "@/lib/forms";

const b = schema.betaApplications;
const STATUSES = ["pending", "approved", "declined"] as const;

/** Approve, decline, or move an application back to pending. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/beta/[id]">) {
  const staff = await requireStaff(req, CAN.beta);
  if (staff instanceof Response) return staff;
  const id = Number((await ctx.params).id);
  const data = await smallJson(req);
  const status = STATUSES.find((s) => s === data?.status);
  if (!Number.isSafeInteger(id) || id <= 0 || !status) return Response.json({ error: "Bad request" }, { status: 400 });
  try {
    const [row] = await db()
      .update(b)
      .set({ status, reviewedAt: status === "pending" ? null : sql`now()`, reviewedBy: status === "pending" ? null : staff.id })
      .where(eq(b.id, id))
      .returning();
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    await logAction(staff.id, `beta.${status}`, `beta:${id}`, { email: row.email });
    return Response.json({ application: row });
  } catch (e) {
    console.error("admin beta PATCH failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
