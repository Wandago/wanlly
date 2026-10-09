import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { CAN, logAction, requireStaff } from "@/lib/admin";
import { field, smallJson } from "@/lib/forms";

const u = schema.users;
/** What the admin page can set. Deleting is the person's own choice, from their profile. */
const STATUSES = ["active", "slowed", "frozen", "banned"] as const;

/** Changes an account's status, with a reason that goes in the audit log. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/users/[id]">) {
  const staff = await requireStaff(req, CAN.users);
  if (staff instanceof Response) return staff;
  const id = decodeURIComponent((await ctx.params).id);
  const data = await smallJson(req);
  const status = STATUSES.find((s) => s === data?.status);
  const reason = data ? field(data, "reason", 300) : "";
  if (!status || !reason) return Response.json({ error: "Pick a status and give a reason." }, { status: 400 });
  if (id === staff.id) return Response.json({ error: "You can't change your own account." }, { status: 400 });
  try {
    const [target] = await db().select({ role: u.role, status: u.status }).from(u).where(eq(u.id, id)).limit(1);
    if (!target || target.status === "deleted") return Response.json({ error: "Not found" }, { status: 404 });
    if (target.role === "owner") return Response.json({ error: "Owner accounts can't be changed here." }, { status: 403 });
    await db().update(u).set({ status, updatedAt: sql`now()` }).where(eq(u.id, id));
    await logAction(staff.id, "user.status", `user:${id}`, { from: target.status, to: status, reason });
    return Response.json({ ok: true, status });
  } catch (e) {
    console.error("admin users PATCH failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
