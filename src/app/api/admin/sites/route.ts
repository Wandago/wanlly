import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { CAN, logAction, requireStaff } from "@/lib/admin";
import { field, smallJson } from "@/lib/forms";
import { dbErrorMessage } from "@/lib/migrations";

const s = schema.publishedSites;

/** The most recently updated published apps, with their owners, for review. */
export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.users);
  if (staff instanceof Response) return staff;
  try {
    const rows = await db()
      .select({ slug: s.slug, disabled: s.disabled, updatedAt: s.updatedAt, email: schema.users.email, size: sql<number>`length(${s.html})` })
      .from(s)
      .leftJoin(schema.users, eq(schema.users.id, s.ownerId))
      .orderBy(desc(s.updatedAt))
      .limit(100);
    return Response.json({ sites: rows });
  } catch (e) {
    return Response.json({ error: dbErrorMessage(e) }, { status: 503 });
  }
}

/** Takes an app down (or puts it back), with a reason in the log. */
export async function PATCH(req: Request) {
  const staff = await requireStaff(req, CAN.users);
  if (staff instanceof Response) return staff;
  const data = await smallJson(req);
  const slug = data ? field(data, "slug", 80) : "";
  const reason = data ? field(data, "reason", 300) : "";
  if (!slug || typeof data?.disabled !== "boolean" || !reason) return Response.json({ error: "Pick an app and give a reason." }, { status: 400 });
  await db().update(s).set({ disabled: data.disabled }).where(eq(s.slug, slug));
  await logAction(staff.id, data.disabled ? "site.disabled" : "site.enabled", `site:${slug}`, { reason });
  return Response.json({ ok: true });
}
