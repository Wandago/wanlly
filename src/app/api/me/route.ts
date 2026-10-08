import { ensureUser } from "@/lib/account";
import { balance, floorUnlockedToday } from "@/lib/ledger";
import { signedInUserId } from "@/lib/session";

/** The signed-in person's account: created on first call, then their balance and today's floor. */
export async function GET(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  try {
    const user = await ensureUser(userId, req.headers.get("cf-ipcountry"));
    const [credits, floorUnlocked] = await Promise.all([balance(user.id), floorUnlockedToday(user.id)]);
    return Response.json({ id: user.id, country: user.country, status: user.status, credits, floorUnlocked });
  } catch (e) {
    console.error("api/me failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
