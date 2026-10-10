import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { MAX_FILE_CHARS, MAX_FILES, ownBuild } from "@/lib/build";
import { field, smallJson } from "@/lib/forms";
import { githubToken, parseRepo, readRepo } from "@/lib/github";
import { SAY } from "@/lib/messages";
import { signedInUserId } from "@/lib/session";

/** Most text brought in from one repository, so a project stays quick to load and to send to the AI. */
const MAX_TOTAL_CHARS = 1_500_000;

/**
 * Opens one of the person's GitHub repositories in a Builder project: its text files replace the
 * project's, so the AI can read and change them, and saving to GitHub later updates that repository.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/build/[id]/github/import">) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  const id = Number((await ctx.params).id);
  const project = Number.isSafeInteger(id) ? await ownBuild(id, userId).catch(() => null) : null;
  if (!project) return Response.json({ error: SAY.notFound }, { status: 404 });
  const target = parseRepo(field((await smallJson(req)) ?? {}, "repo", 200));
  if (!target) return Response.json({ error: "Paste the link to your repository, like github.com/you/my-site." }, { status: 400 });
  const { token } = await githubToken(userId);
  if (!token) return Response.json({ error: "Connect GitHub first.", connect: true }, { status: 403 });
  try {
    const repo = await readRepo(token, target, { maxFiles: MAX_FILES, maxFileChars: MAX_FILE_CHARS, maxTotalChars: MAX_TOTAL_CHARS });
    if (!repo.files.length) return Response.json({ error: "That repository has no text files Wanlly can open." }, { status: 400 });
    const d = db();
    const f = schema.buildFiles;
    // Few, large queries: each database call counts against Cloudflare's per-request limit.
    const chunks: (typeof repo.files)[] = [];
    for (let i = 0; i < repo.files.length; i += 60) chunks.push(repo.files.slice(i, i + 60));
    await d.batch([
      d.delete(f).where(eq(f.projectId, id)),
      ...chunks.map((c) => d.insert(f).values(c.map((x) => ({ projectId: id, path: x.path, content: x.content })))),
      d.update(schema.projects).set({ name: target.name.slice(0, 80), updatedAt: sql`now()` }).where(eq(schema.projects.id, id)),
    ] as unknown as Parameters<typeof d.batch>[0]);
    return Response.json({ files: repo.files.length, skipped: repo.skipped, url: repo.url, branch: repo.branch, repo: repo.url });
  } catch (e) {
    console.error("github import failed", e instanceof Error ? e.message : e);
    return Response.json({ error: e instanceof Error ? e.message : SAY.busy }, { status: 502 });
  }
}
