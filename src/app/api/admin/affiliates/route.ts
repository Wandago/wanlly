import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { CAN, logAction, requireStaff } from "@/lib/admin";
import { cleanAffiliates } from "@/lib/affiliates";
import { loadAffiliates } from "@/lib/affiliates-server";
import { jsonUpTo } from "@/lib/forms";
import { dbErrorMessage } from "@/lib/migrations";

/** The affiliate list, for Admin. */
export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.view);
  if (staff instanceof Response) return staff;
  return Response.json({ affiliates: await loadAffiliates() });
}

/** Saves the whole affiliate list. Owners and admins only. */
export async function PUT(req: Request) {
  const staff = await requireStaff(req, CAN.advertisers);
  if (staff instanceof Response) return staff;
  const data = await jsonUpTo(req, 100_000);
  if (!data) return Response.json({ error: "Bad request" }, { status: 400 });
  // Offers get a postback secret the first time they're saved; existing ones keep theirs.
  const affiliates = cleanAffiliates(data.affiliates).map((a) => (a.credits && !a.secret ? { ...a, secret: crypto.randomUUID().replace(/-/g, "") } : a));
  try {
    await db()
      .insert(schema.appFlags)
      .values({ key: "affiliates", value: affiliates, updatedBy: staff.id })
      .onConflictDoUpdate({ target: schema.appFlags.key, set: { value: affiliates, updatedBy: staff.id, updatedAt: sql`now()` } });
    await logAction(staff.id, "affiliates.saved", "flag:affiliates", { count: affiliates.length });
    return Response.json({ affiliates });
  } catch (e) {
    console.error("affiliates save failed", e);
    return Response.json({ error: dbErrorMessage(e) }, { status: 503 });
  }
}
