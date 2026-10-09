import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { CAN, FLAGS, logAction, requireStaff, type FlagKey } from "@/lib/admin";
import { field, smallJson } from "@/lib/forms";

/** Flips a pause switch for everyone. Owners and admins only, with a reason in the log. */
export async function POST(req: Request) {
  const staff = await requireStaff(req, CAN.switches);
  if (staff instanceof Response) return staff;
  const data = await smallJson(req);
  const key = data && typeof data.key === "string" && data.key in FLAGS ? (data.key as FlagKey) : null;
  const reason = data ? field(data, "reason", 300) : "";
  if (!key || typeof data?.on !== "boolean" || !reason) return Response.json({ error: "Pick a switch and give a reason." }, { status: 400 });
  try {
    await db()
      .insert(schema.appFlags)
      .values({ key, value: data.on, updatedBy: staff.id })
      .onConflictDoUpdate({ target: schema.appFlags.key, set: { value: data.on, updatedBy: staff.id, updatedAt: sql`now()` } });
    await logAction(staff.id, data.on ? `switch.${key}.on` : `switch.${key}.off`, `flag:${key}`, { reason });
    return Response.json({ ok: true, key, on: data.on });
  } catch (e) {
    console.error("admin flags failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
