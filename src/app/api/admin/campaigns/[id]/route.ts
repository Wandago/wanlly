import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { CAN, logAction, requireStaff } from "@/lib/admin";
import { campaignFields, needsMigration } from "@/lib/campaigns";
import { jsonUpTo } from "@/lib/forms";

const c = schema.campaigns;

/** Edits a campaign, including pausing, starting and ending it. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/campaigns/[id]">) {
  const staff = await requireStaff(req, CAN.advertisers);
  if (staff instanceof Response) return staff;
  const id = Number((await ctx.params).id);
  const data = await jsonUpTo(req, 2_600_000);
  if (!Number.isSafeInteger(id) || id <= 0 || !data) return Response.json({ error: "Bad request" }, { status: 400 });
  const r = campaignFields(data);
  if ("error" in r) return Response.json({ error: r.error }, { status: 422 });
  try {
    const [row] = await db().update(c).set({ ...r.ok, updatedAt: sql`now()` }).where(eq(c.id, id)).returning({ id: c.id, status: c.status, name: c.name });
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    await logAction(staff.id, r.ok.status ? `campaign.${r.ok.status}` : "campaign.edited", `campaign:${id}`, { name: row.name, fields: Object.keys(r.ok).filter((k) => k !== "image") });
    return Response.json({ ok: true, status: row.status });
  } catch (e) {
    console.error("admin campaign PATCH failed", e);
    return Response.json({ error: needsMigration(e) ?? "Database unavailable" }, { status: 503 });
  }
}
