import { startView } from "@/lib/earn";
import { smallJson, field } from "@/lib/forms";
import { signedInUserId } from "@/lib/session";

/** Starts a rewarded video and returns the one-time view id the client sends back when it ends. */
export async function POST(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const data = await smallJson(req);
  if (!data) return Response.json({ error: "Bad request" }, { status: 400 });
  try {
    const r = await startView(userId, field(data, "placement", 40), req.headers.get("cf-ipcountry"));
    return "error" in r ? Response.json({ error: r.error }, { status: r.status }) : Response.json(r);
  } catch (e) {
    console.error("earn/start failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
