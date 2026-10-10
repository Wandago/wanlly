import { MAX_FILE_CHARS, MAX_FILES, cleanPath, deleteFile, loadFiles, ownBuild } from "@/lib/build";
import { db, schema } from "@/db";
import { jsonUpTo } from "@/lib/forms";
import { SAY } from "@/lib/messages";
import { signedInUserId } from "@/lib/session";

async function guard(req: Request, ctx: RouteContext<"/api/build/[id]/files">) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isSafeInteger(id) || !(await ownBuild(id, userId).catch(() => null))) return Response.json({ error: SAY.notFound }, { status: 404 });
  return id;
}

/** Saves a file the person edited (or added) by hand. */
export async function PUT(req: Request, ctx: RouteContext<"/api/build/[id]/files">) {
  const id = await guard(req, ctx);
  if (id instanceof Response) return id;
  const data = await jsonUpTo(req, MAX_FILE_CHARS * 2);
  const path = cleanPath(data?.path);
  const content = typeof data?.content === "string" ? data.content : null;
  if (!path || content === null || content.length > MAX_FILE_CHARS) return Response.json({ error: "Give the file a name inside the project, and keep it under 300,000 characters." }, { status: 400 });
  const files = await loadFiles(id);
  if (!files.has(path) && files.size >= MAX_FILES) return Response.json({ error: `A project can hold ${MAX_FILES} files.` }, { status: 400 });
  await db()
    .insert(schema.buildFiles)
    .values({ projectId: id, path, content })
    .onConflictDoUpdate({ target: [schema.buildFiles.projectId, schema.buildFiles.path], set: { content, updatedAt: new Date() } });
  return Response.json({ ok: true, path });
}

/** Deletes a file. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/build/[id]/files">) {
  const id = await guard(req, ctx);
  if (id instanceof Response) return id;
  const path = cleanPath(new URL(req.url).searchParams.get("path"));
  if (!path) return Response.json({ error: SAY.badRequest }, { status: 400 });
  await deleteFile(id, path);
  return Response.json({ ok: true });
}
