import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { smallJson } from "@/lib/forms";
import { MAX_PROJECTS, projectFields } from "@/lib/projects";
import { signedInUserId } from "@/lib/session";

const p = schema.projects;
const cols = { id: p.id, name: p.name, tool: p.tool, about: p.about, instructions: p.instructions, modelId: p.modelId, createdAt: p.createdAt, updatedAt: p.updatedAt };

/** The signed-in person's projects, most recently changed first. */
export async function GET(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  try {
    const projects = await db().select(cols).from(p).where(and(eq(p.ownerId, userId), isNull(p.deletedAt))).orderBy(desc(p.updatedAt)).limit(MAX_PROJECTS);
    return Response.json({ projects });
  } catch (e) {
    console.error("projects GET failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const data = await smallJson(req);
  const f = data ? projectFields(data) : {};
  if (!f.name || !f.tool) return Response.json({ error: "Give the project a name and pick a tool." }, { status: 422 });
  try {
    const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(p).where(and(eq(p.ownerId, userId), isNull(p.deletedAt)));
    if (n >= MAX_PROJECTS) return Response.json({ error: `You can have up to ${MAX_PROJECTS} projects. Delete one to make room.` }, { status: 429 });
    const [project] = await db()
      .insert(p)
      .values({ ownerId: userId, name: f.name, tool: f.tool, about: f.about ?? "", instructions: f.instructions ?? "", modelId: f.modelId ?? "gemini-flash" })
      .returning(cols);
    return Response.json({ project });
  } catch (e) {
    console.error("projects POST failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
