import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { ensureUser } from "@/lib/account";
import { balance, floorUnlockedToday } from "@/lib/ledger";

/** The signed-in person's account: created on first call, then their balance and today's floor. */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  try {
    const user = await ensureUser(req.headers.get("cf-ipcountry"));
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
    const [credits, floorUnlocked] = await Promise.all([balance(user.id), floorUnlockedToday(user.id)]);
    return Response.json({ id: user.id, country: user.country, status: user.status, credits, floorUnlocked });
  } catch (e) {
    console.error("api/me failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
