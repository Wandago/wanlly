import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { designFile, idParam } from "@/lib/design";
import { signedInUserId } from "@/lib/session";
import { SAY } from "@/lib/messages";

const v = schema.designVersions;

/** A design file with its version history (newest first) and the newest version's page. */
export async function GET(req: Request, ctx: RouteContext<"/api/design/[id]">) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  const id = idParam((await ctx.params).id);
  if (!id) return Response.json({ error: SAY.badRequest }, { status: 400 });
  try {
    const file = await designFile(userId, id);
    if (!file) return Response.json({ error: SAY.notFound }, { status: 404 });
    const versions = await db()
      .select({ id: v.id, prompt: v.prompt, modelId: v.modelId, credits: v.credits, createdAt: v.createdAt })
      .from(v)
      .where(eq(v.projectId, id))
      .orderBy(desc(v.id))
      .limit(100);
    const [latest] = versions.length ? await db().select({ id: v.id, html: v.html }).from(v).where(eq(v.id, versions[0].id)).limit(1) : [];
    return Response.json({ file, versions, latest: latest ?? null });
  } catch (e) {
    console.error("design GET failed", e);
    return Response.json({ error: SAY.busy }, { status: 503 });
  }
}
