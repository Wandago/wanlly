import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { field, smallJson } from "@/lib/forms";
import { SAY } from "@/lib/messages";
import { MAX_PROJECTS } from "@/lib/projects";
import { signedInUserId } from "@/lib/session";

const p = schema.projects;

/** This person's Builder projects, newest first. */
export async function GET(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  try {
    const rows = await db()
      .select({ id: p.id, name: p.name, updatedAt: p.updatedAt })
      .from(p)
      .where(and(eq(p.ownerId, userId), eq(p.kind, "build"), isNull(p.deletedAt)))
      .orderBy(desc(p.updatedAt))
      .limit(MAX_PROJECTS);
    return Response.json({ projects: rows });
  } catch {
    return Response.json({ error: SAY.busy }, { status: 503 });
  }
}

/** Starts a new Builder project. */
export async function POST(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  const data = await smallJson(req);
  const name = (data ? field(data, "name", 80) : "") || "New app";
  try {
    const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(p).where(and(eq(p.ownerId, userId), isNull(p.deletedAt)));
    if (n >= MAX_PROJECTS) return Response.json({ error: `You can have up to ${MAX_PROJECTS} projects. Delete one to make room.` }, { status: 429 });
    const [row] = await db().insert(p).values({ ownerId: userId, name, tool: "code", kind: "build", modelId: "sonnet" }).returning({ id: p.id });
    return Response.json({ id: row.id });
  } catch (e) {
    console.error("build create failed", e);
    return Response.json({ error: SAY.busy }, { status: 503 });
  }
}
