import { blockedReason } from "@/lib/admin";
import { completeView } from "@/lib/earn";
import { smallJson, field } from "@/lib/forms";
import { account } from "@/lib/ledger";
import { signedInUserId } from "@/lib/session";
import { SAY } from "@/lib/messages";

/** Pays for a finished video, once, and returns the new balance. */
export async function POST(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  const blocked = await blockedReason(userId, "earn").catch(() => null);
  if (blocked) return Response.json({ error: blocked }, { status: 403 });
  const data = await smallJson(req);
  const viewId = data ? field(data, "viewId", 64) : "";
  if (!viewId) return Response.json({ error: SAY.badRequest }, { status: 400 });
  try {
    const r = await completeView(userId, viewId, req.headers.get("cf-ipcountry"));
    if ("error" in r) return Response.json({ error: r.error, ...("need" in r ? { need: r.need } : {}) }, { status: r.status });
    return Response.json({ ...r, ...(await account(userId)) });
  } catch (e) {
    console.error("earn/complete failed", e);
    return Response.json({ error: SAY.busy }, { status: 503 });
  }
}
