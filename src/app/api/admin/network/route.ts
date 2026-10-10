import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { cleanNetworks } from "@/lib/ad-network";
import { loadNetworks } from "@/lib/ad-network-server";
import { rankNetworks } from "@/lib/ad-rank";
import { CAN, logAction, requireStaff } from "@/lib/admin";
import { dbErrorMessage } from "@/lib/migrations";
import { jsonUpTo } from "@/lib/forms";

/** Every ad network, the shared banner host, and how each one ranks on real earnings. */
export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.view);
  if (staff instanceof Response) return staff;
  const networks = await loadNetworks();
  return Response.json({ ...networks, ranks: await rankNetworks(networks.list).catch(() => []) });
}

/** Saves the networks: names, who sees each, banner codes and expected rates. Owners and admins only. */
export async function PUT(req: Request) {
  const staff = await requireStaff(req, CAN.advertisers);
  if (staff instanceof Response) return staff;
  const data = await jsonUpTo(req, 200_000);
  if (!data) return Response.json({ error: "Bad request" }, { status: 400 });
  const networks = cleanNetworks(data);
  try {
    await db()
      .insert(schema.appFlags)
      .values({ key: "adNetworks", value: networks, updatedBy: staff.id })
      .onConflictDoUpdate({ target: schema.appFlags.key, set: { value: networks, updatedBy: staff.id, updatedAt: sql`now()` } });
    await logAction(staff.id, "network.saved", "flag:adNetworks", { networks: networks.list.map((n) => ({ name: n.name, audience: n.audience, sizes: Object.keys(n.units), ecpm: n.ecpm })) });
    return Response.json({ ...networks, ranks: await rankNetworks(networks.list).catch(() => []) });
  } catch (e) {
    console.error("admin network failed", e);
    return Response.json({ error: dbErrorMessage(e) }, { status: 503 });
  }
}
