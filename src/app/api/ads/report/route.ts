import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { field, smallJson } from "@/lib/forms";
import { signedInUserId } from "@/lib/session";

/** Someone reported an ad. It lands in Admin → Messages for the team to review. */
export async function POST(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const data = await smallJson(req);
  const creative = data ? field(data, "creative", 80) : "";
  if (!creative) return Response.json({ error: "Bad request" }, { status: 400 });
  try {
    const [me] = await db().select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    await db()
      .insert(schema.contactMessages)
      .values({
        name: "Ad report",
        email: me?.email ?? userId,
        topic: "Ad report",
        message: `${field(data!, "advertiser", 80)} (${creative}): ${field(data!, "reason", 500) || "No reason given"}`,
        networkCountry: req.headers.get("cf-ipcountry"),
      });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("ad report failed", e);
    return Response.json({ error: "Couldn't send the report." }, { status: 503 });
  }
}
