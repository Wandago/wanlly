import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { CAN, requireStaff } from "@/lib/admin";

const a = schema.advertiserApplications;

/** Applications to advertise, newest first, optionally by status. */
export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.advertisers);
  if (staff instanceof Response) return staff;
  const status = (["pending", "approved", "declined"] as const).find((s) => s === new URL(req.url).searchParams.get("status"));
  try {
    const rows = await db().select().from(a).where(status ? eq(a.status, status) : undefined).orderBy(desc(a.createdAt)).limit(200);
    return Response.json({ applications: rows });
  } catch (e) {
    console.error("admin advertisers GET failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
