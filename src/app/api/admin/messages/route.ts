import { desc, isNotNull, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { CAN, requireStaff } from "@/lib/admin";

const m = schema.contactMessages;

export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.messages);
  if (staff instanceof Response) return staff;
  const show = new URL(req.url).searchParams.get("show");
  try {
    const rows = await db()
      .select()
      .from(m)
      .where(show === "handled" ? isNotNull(m.handledAt) : show === "all" ? undefined : isNull(m.handledAt))
      .orderBy(desc(m.createdAt))
      .limit(200);
    return Response.json({ messages: rows });
  } catch (e) {
    console.error("admin messages GET failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
