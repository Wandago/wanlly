import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { MAX_PAGE, designFile, idParam } from "@/lib/design";
import { signedInUserId } from "@/lib/session";

/** Saves a version edited by hand in the preview. Free: no model is involved. */
export async function POST(req: Request, ctx: RouteContext<"/api/design/[id]/versions">) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const id = idParam((await ctx.params).id);
  const text = await req.text();
  if (!id || text.length > MAX_PAGE + 1000) return Response.json({ error: "That page is too large to save." }, { status: 413 });
  let html = "";
  try {
    const body = JSON.parse(text) as { html?: unknown };
    html = typeof body.html === "string" ? body.html : "";
  } catch {}
  if (html.length < 200 || !/<(html|body)[\s>]/i.test(html)) return Response.json({ error: "Bad request" }, { status: 400 });
  try {
    if (!(await designFile(userId, id))) return Response.json({ error: "Not found" }, { status: 404 });
    const v = schema.designVersions;
    const [row] = await db().insert(v).values({ projectId: id, prompt: "Edited by hand", html, modelId: "edit", credits: 0 }).returning({ id: v.id, createdAt: v.createdAt });
    await db().update(schema.projects).set({ updatedAt: sql`now()` }).where(eq(schema.projects.id, id));
    return Response.json({ id: row.id, createdAt: row.createdAt });
  } catch (e) {
    console.error("design save failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
