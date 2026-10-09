import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { designFile, idParam } from "@/lib/design";
import { signedInUserId } from "@/lib/session";

const v = schema.designVersions;

/** One earlier version's page. */
export async function GET(req: Request, ctx: RouteContext<"/api/design/[id]/versions/[vid]">) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const params = await ctx.params;
  const id = idParam(params.id);
  const vid = idParam(params.vid);
  if (!id || !vid) return Response.json({ error: "Bad request" }, { status: 400 });
  try {
    if (!(await designFile(userId, id))) return Response.json({ error: "Not found" }, { status: 404 });
    const [row] = await db().select({ id: v.id, html: v.html }).from(v).where(and(eq(v.id, vid), eq(v.projectId, id))).limit(1);
    return row ? Response.json(row) : Response.json({ error: "Not found" }, { status: 404 });
  } catch (e) {
    console.error("design version GET failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
