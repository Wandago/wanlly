import { completeView } from "@/lib/earn";
import { smallJson, field } from "@/lib/forms";
import { balance, floorUnlockedToday } from "@/lib/ledger";
import { signedInUserId } from "@/lib/session";

/** Pays for a finished video, once, and returns the new balance. */
export async function POST(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const data = await smallJson(req);
  const viewId = data ? field(data, "viewId", 64) : "";
  if (!viewId) return Response.json({ error: "Bad request" }, { status: 400 });
  try {
    const r = await completeView(userId, viewId, req.headers.get("cf-ipcountry"));
    if ("error" in r) return Response.json({ error: r.error }, { status: r.status });
    const [credits, floorUnlocked] = await Promise.all([balance(userId), floorUnlockedToday(userId)]);
    return Response.json({ ...r, credits, floorUnlocked });
  } catch (e) {
    console.error("earn/complete failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
