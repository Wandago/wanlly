import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { CAN, logAction, requireStaff } from "@/lib/admin";
import { smallJson } from "@/lib/forms";

const a = schema.advertiserApplications;

/** Approve, decline, or move an application back to pending. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/advertisers/[id]">) {
  const staff = await requireStaff(req, CAN.advertisers);
  if (staff instanceof Response) return staff;
  const id = Number((await ctx.params).id);
  const data = await smallJson(req);
  const status = (["pending", "approved", "declined"] as const).find((s) => s === data?.status);
  if (!Number.isSafeInteger(id) || id <= 0 || !status) return Response.json({ error: "Bad request" }, { status: 400 });
  try {
    const [row] = await db()
      .update(a)
      .set({ status, reviewedAt: status === "pending" ? null : sql`now()`, reviewedBy: status === "pending" ? null : staff.id })
      .where(eq(a.id, id))
      .returning();
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    await logAction(staff.id, `advertiser.${status}`, `advertiser:${id}`, { company: row.company });
    return Response.json({ application: row });
  } catch (e) {
    console.error("admin advertiser PATCH failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
