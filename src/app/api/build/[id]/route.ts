import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { loadFiles, loadSteps, ownBuild } from "@/lib/build";
import { field, smallJson } from "@/lib/forms";
import { SAY } from "@/lib/messages";
import { signedInUserId } from "@/lib/session";

type Block = { type: string; text?: string; name?: string; input?: Record<string, unknown>; content?: unknown; is_error?: boolean };

/**
 * A Builder project: its files and its conversation, shaped for the screen: what the person
 * asked, what the AI said, and which files each step viewed or changed.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/build/[id]">) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isSafeInteger(id)) return Response.json({ error: SAY.notFound }, { status: 404 });
  try {
    const project = await ownBuild(id, userId);
    if (!project) return Response.json({ error: SAY.notFound }, { status: 404 });
    const [files, steps] = await Promise.all([loadFiles(id), loadSteps(id)]);
    return Response.json({
      project: { id: project.id, name: project.name },
      files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, content]) => ({ path, content })),
      steps: steps.flatMap((s) => {
        const blocks = (Array.isArray(s.content) ? s.content : []) as Block[];
        if (s.role === "user") {
          const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n");
          return text ? [{ id: s.id, role: "user", text }] : [];
        }
        return [
          {
            id: s.id,
            role: "assistant",
            text: blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n"),
            edits: blocks.filter((b) => b.type === "tool_use").map((b) => ({ command: String(b.input?.command ?? ""), path: String(b.input?.path ?? "") })),
            modelId: s.modelId,
            credits: s.credits,
          },
        ];
      }),
    });
  } catch (e) {
    console.error("build GET failed", e);
    return Response.json({ error: SAY.busy }, { status: 503 });
  }
}

/** Renames the project, or starts a new thread: the conversation is cleared and the files stay. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/build/[id]">) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  const id = Number((await ctx.params).id);
  const data = await smallJson(req);
  if (!Number.isSafeInteger(id) || !data || !(await ownBuild(id, userId).catch(() => null))) return Response.json({ error: SAY.notFound }, { status: 404 });
  if (data.action === "new-thread") await db().delete(schema.buildSteps).where(eq(schema.buildSteps.projectId, id));
  const name = field(data, "name", 80);
  if (name) await db().update(schema.projects).set({ name, updatedAt: sql`now()` }).where(eq(schema.projects.id, id));
  return Response.json({ ok: true });
}

/** Deletes the project (files and conversation go too). */
export async function DELETE(req: Request, ctx: RouteContext<"/api/build/[id]">) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isSafeInteger(id) || !(await ownBuild(id, userId).catch(() => null))) return Response.json({ error: SAY.notFound }, { status: 404 });
  await db().delete(schema.buildSteps).where(eq(schema.buildSteps.projectId, id));
  await db().delete(schema.buildFiles).where(eq(schema.buildFiles.projectId, id));
  await db().update(schema.projects).set({ deletedAt: sql`now()` }).where(eq(schema.projects.id, id));
  return Response.json({ ok: true });
}
