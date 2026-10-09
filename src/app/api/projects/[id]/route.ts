import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { smallJson } from "@/lib/forms";
import { projectFields } from "@/lib/projects";
import { signedInUserId } from "@/lib/session";

const p = schema.projects;
const cols = { id: p.id, name: p.name, tool: p.tool, about: p.about, instructions: p.instructions, modelId: p.modelId, createdAt: p.createdAt, updatedAt: p.updatedAt };

/** Only the owner's own, undeleted project matches. */
const mine = (userId: string, id: number) => and(eq(p.id, id), eq(p.ownerId, userId), isNull(p.deletedAt));

function projectId(raw: string) {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const id = projectId((await ctx.params).id);
  const data = await smallJson(req);
  if (!id || !data) return Response.json({ error: "Bad request" }, { status: 400 });
  const f = projectFields(data);
  if ("name" in f && !f.name) return Response.json({ error: "A project needs a name." }, { status: 422 });
  try {
    const [project] = await db().update(p).set({ ...f, updatedAt: sql`now()` }).where(mine(userId, id)).returning(cols);
    return project ? Response.json({ project }) : Response.json({ error: "Not found" }, { status: 404 });
  } catch (e) {
    console.error("project PATCH failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const id = projectId((await ctx.params).id);
  if (!id) return Response.json({ error: "Bad request" }, { status: 400 });
  try {
    const rows = await db().update(p).set({ deletedAt: sql`now()` }).where(mine(userId, id)).returning({ id: p.id });
    return rows.length ? Response.json({ ok: true }) : Response.json({ error: "Not found" }, { status: 404 });
  } catch (e) {
    console.error("project DELETE failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
