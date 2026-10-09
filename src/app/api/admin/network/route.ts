import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { cleanNetwork } from "@/lib/ad-network";
import { loadNetwork } from "@/lib/ad-network-server";
import { CAN, logAction, requireStaff } from "@/lib/admin";
import { jsonUpTo } from "@/lib/forms";

/** The ad network settings, for the admin form. */
export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.view);
  if (staff instanceof Response) return staff;
  return Response.json({ network: await loadNetwork() });
}

/** Saves the network name, who sees it, and its banner codes. Owners and admins only. */
export async function PUT(req: Request) {
  const staff = await requireStaff(req, CAN.advertisers);
  if (staff instanceof Response) return staff;
  const data = await jsonUpTo(req, 40_000);
  if (!data) return Response.json({ error: "Bad request" }, { status: 400 });
  const network = cleanNetwork(data);
  try {
    await db()
      .insert(schema.appFlags)
      .values({ key: "adNetwork", value: network, updatedBy: staff.id })
      .onConflictDoUpdate({ target: schema.appFlags.key, set: { value: network, updatedBy: staff.id, updatedAt: sql`now()` } });
    await logAction(staff.id, "network.saved", "flag:adNetwork", { name: network.name, audience: network.audience, sizes: Object.keys(network.units) });
    return Response.json({ network });
  } catch (e) {
    console.error("admin network failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
