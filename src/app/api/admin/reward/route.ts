import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { CAN, logAction, requireStaff } from "@/lib/admin";
import { jsonUpTo } from "@/lib/forms";
import { dbErrorMessage } from "@/lib/migrations";
import { cleanPolicy, clearRewardCache, rewardNow } from "@/lib/reward";

/** Credits per ad right now, the rule behind it, and what ads really earned per finished ad. */
export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.view);
  if (staff instanceof Response) return staff;
  return Response.json(await rewardNow());
}

/** Sets the rule: a fixed number of credits per ad, or a share of real earnings. Owners and admins only. */
export async function PUT(req: Request) {
  const staff = await requireStaff(req, CAN.switches);
  if (staff instanceof Response) return staff;
  const data = await jsonUpTo(req, 2000);
  if (!data) return Response.json({ error: "Bad request" }, { status: 400 });
  const policy = cleanPolicy(data);
  try {
    await db()
      .insert(schema.appFlags)
      .values({ key: "rewardPolicy", value: policy, updatedBy: staff.id })
      .onConflictDoUpdate({ target: schema.appFlags.key, set: { value: policy, updatedBy: staff.id, updatedAt: sql`now()` } });
    await logAction(staff.id, "reward.policy", "flag:rewardPolicy", policy);
    clearRewardCache();
    return Response.json(await rewardNow());
  } catch (e) {
    return Response.json({ error: dbErrorMessage(e) }, { status: 503 });
  }
}
