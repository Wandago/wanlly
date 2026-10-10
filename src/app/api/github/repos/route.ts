import { githubRepos, githubToken } from "@/lib/github";
import { SAY } from "@/lib/messages";
import { signedInUserId } from "@/lib/session";

/** The person's GitHub repositories (newest activity first), when GitHub is connected. */
export async function GET(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  const t = await githubToken(userId);
  if (!t.token) return Response.json({ ready: false, connected: t.connected, repos: [] });
  try {
    return Response.json({ ready: true, connected: true, repos: await githubRepos(t.token) });
  } catch {
    return Response.json({ ready: false, connected: true, repos: [], error: "GitHub didn't answer. Try again in a moment." });
  }
}
