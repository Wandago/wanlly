import { blockedReason } from "@/lib/admin";
import { startView } from "@/lib/earn";
import { smallJson, field } from "@/lib/forms";
import { signedInUserId } from "@/lib/session";
import { SAY } from "@/lib/messages";

/** Starts a rewarded video and returns the one-time view id the client sends back when it ends. */
export async function POST(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  const blocked = await blockedReason(userId, "earn").catch(() => null);
  if (blocked) return Response.json({ error: blocked }, { status: 403 });
  const data = await smallJson(req);
  if (!data) return Response.json({ error: SAY.badRequest }, { status: 400 });
  try {
    const r = await startView(userId, field(data, "placement", 40), req.headers.get("cf-ipcountry"));
    return "error" in r ? Response.json({ error: r.error, ...("need" in r ? { need: r.need } : {}) }, { status: r.status }) : Response.json(r);
  } catch (e) {
    console.error("earn/start failed", e);
    return Response.json({ error: SAY.busy }, { status: 503 });
  }
}
