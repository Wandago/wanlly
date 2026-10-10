import { loadFiles, ownBuild } from "@/lib/build";
import { field, smallJson } from "@/lib/forms";
import { githubLogin, githubToken, parseRepo, pushToGithub } from "@/lib/github";
import { SAY } from "@/lib/messages";
import { signedInUserId } from "@/lib/session";

/** Whether GitHub is connected with permission to save repositories. */
export async function GET(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  const t = await githubToken(userId);
  const login = t.token ? await githubLogin(t.token).catch(() => null) : null;
  return Response.json({ connected: t.connected, ready: !!t.token, login });
}

/** Saves the project to the person's GitHub as a commit on the repository's main branch. */
export async function POST(req: Request, ctx: RouteContext<"/api/build/[id]/github">) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  const id = Number((await ctx.params).id);
  const project = Number.isSafeInteger(id) ? await ownBuild(id, userId).catch(() => null) : null;
  if (!project) return Response.json({ error: SAY.notFound }, { status: 404 });
  const data = await smallJson(req);
  const { token } = await githubToken(userId);
  if (!token) return Response.json({ error: "Connect GitHub first.", connect: true }, { status: 403 });
  const files = [...(await loadFiles(id))].map(([path, content]) => ({ path, content }));
  if (!files.length) return Response.json({ error: "There are no files to save yet." }, { status: 400 });
  try {
    const target = parseRepo(field(data ?? {}, "repo", 200) || project.name);
    if (!target) return Response.json({ error: "Give a repository name or a GitHub link." }, { status: 400 });
    const url = await pushToGithub(token, target, files, field(data ?? {}, "message", 200) || "Update from Wanlly");
    return Response.json({ url });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : SAY.busy }, { status: 502 });
  }
}
