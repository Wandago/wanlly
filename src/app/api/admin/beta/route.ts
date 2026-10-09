import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { CAN, requireStaff } from "@/lib/admin";

const b = schema.betaApplications;
const STATUSES = ["pending", "approved", "declined"] as const;

export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.beta);
  if (staff instanceof Response) return staff;
  const status = new URL(req.url).searchParams.get("status");
  const filter = STATUSES.find((s) => s === status);
  try {
    const rows = await db()
      .select()
      .from(b)
      .where(filter ? eq(b.status, filter) : undefined)
      .orderBy(desc(b.createdAt))
      .limit(200);
    return Response.json({ applications: rows });
  } catch (e) {
    console.error("admin beta GET failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
