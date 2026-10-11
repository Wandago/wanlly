import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { blockedReason } from "@/lib/admin";
import { cpxReady, cpxWallUrl } from "@/lib/cpx";
import { SAY } from "@/lib/messages";
import { signedInUserId } from "@/lib/session";

/** The signed-in person's survey wall address, or 404 while surveys aren't set up. */
export async function GET(req: Request) {
  if (!cpxReady()) return Response.json({ error: "Surveys aren't on yet." }, { status: 404 });
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  const blocked = await blockedReason(userId, "earn").catch(() => null);
  if (blocked) return Response.json({ error: blocked }, { status: 403 });
  const [me] = await db().select({ name: schema.users.name, email: schema.users.email }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  return Response.json({ url: cpxWallUrl(userId, me?.name, me?.email) });
}
