import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { clearAccess, setAccess } from "@/lib/access";
import { CAN, logAction, requireStaff } from "@/lib/admin";
import { field, smallJson } from "@/lib/forms";

const MODES = ["unlimited", "custom"] as const;
const limit = (v: unknown) => (v === null || v === "" || v === undefined ? null : Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) <= 100_000 ? Number(v) : NaN);

/**
 * Gives one person extra usage until a date: no limits ("unlimited") or their own session and
 * weekly limits ("custom"), optionally free (credits topped up as they use them). Owners and admins.
 */
export async function PUT(req: Request, ctx: RouteContext<"/api/admin/users/[id]/access">) {
  const staff = await requireStaff(req, CAN.credits);
  if (staff instanceof Response) return staff;
  const id = decodeURIComponent((await ctx.params).id);
  const data = await smallJson(req);
  const mode = MODES.find((m) => m === data?.mode);
  const days = Number(data?.days);
  const dayLimit = limit(data?.dayLimit);
  const weekLimit = limit(data?.weekLimit);
  const note = data ? field(data, "note", 300) : "";
  if (!mode) return Response.json({ error: "Pick unlimited or custom limits." }, { status: 400 });
  if (!Number.isInteger(days) || days < 1 || days > 365) return Response.json({ error: "Give it between 1 and 365 days." }, { status: 400 });
  if (mode === "custom" && (Number.isNaN(dayLimit) || Number.isNaN(weekLimit) || (dayLimit === null && weekLimit === null)))
    return Response.json({ error: "Set a session limit, a weekly limit, or both (whole numbers up to 100,000)." }, { status: 400 });
  if (!note) return Response.json({ error: "Give a reason. It goes in the log." }, { status: 400 });
  try {
    const [target] = await db().select({ status: schema.users.status }).from(schema.users).where(eq(schema.users.id, id)).limit(1);
    if (!target || target.status === "deleted") return Response.json({ error: "Not found" }, { status: 404 });
    const access = {
      unlimited: mode === "unlimited",
      dayLimit: mode === "custom" ? dayLimit : null,
      weekLimit: mode === "custom" ? weekLimit : null,
      free: data?.free === true,
      expiresAt: new Date(Date.now() + days * 86_400_000).toISOString(),
      note,
    };
    await setAccess(id, access, staff.id);
    await logAction(staff.id, "user.access.set", `user:${id}`, { ...access, days });
    return Response.json({ ok: true, access: { ...access, grantedBy: staff.id } });
  } catch (e) {
    console.error("admin access PUT failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}

/** Back to the standard limits now. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/admin/users/[id]/access">) {
  const staff = await requireStaff(req, CAN.credits);
  if (staff instanceof Response) return staff;
  const id = decodeURIComponent((await ctx.params).id);
  try {
    await clearAccess(id);
    await logAction(staff.id, "user.access.clear", `user:${id}`);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("admin access DELETE failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
