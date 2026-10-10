import "server-only";
import { clerk } from "./session";

/*
 * Saving a Builder project to the person's own GitHub, with the GitHub account they connected
 * through Clerk. It needs the "repo" permission (asked for the first time they press the
 * button). The token stays on the server; it is only used for this person's own repositories.
 */

export const GITHUB_SCOPE = "repo";
const API = "https://api.github.com";

export async function githubToken(userId: string): Promise<{ token?: string; connected: boolean }> {
  try {
    const { data } = await clerk().users.getUserOauthAccessToken(userId, "github");
    const t = data[0];
    if (!t) return { connected: false };
    return t.scopes?.includes(GITHUB_SCOPE) ? { token: t.token, connected: true } : { connected: true };
  } catch {
    return { connected: false };
  }
}

async function gh<T>(token: string, path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T }> {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "Wanlly", ...(init.body ? { "content-type": "application/json" } : {}) },
  });
  return { ok: r.ok, status: r.status, data: (await r.json().catch(() => ({}))) as T };
}

/** A repository name GitHub accepts. */
export const repoName = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "wanlly-app";

/**
 * Commits every file to the repository's main branch (creating a private repository the first
 * time), so the repository matches the project exactly. Returns the repository's address.
 */
export async function pushToGithub(token: string, repo: string, files: { path: string; content: string }[], message: string): Promise<string> {
  const me = await gh<{ login: string }>(token, "/user");
  if (!me.ok) throw new Error("GitHub didn't accept the connection. Connect GitHub again.");
  const full = `${me.data.login}/${repo}`;
  let info = await gh<{ default_branch: string; html_url: string }>(token, `/repos/${full}`);
  if (info.status === 404) {
    const made = await gh<{ default_branch: string; html_url: string; message?: string }>(token, "/user/repos", {
      method: "POST",
      body: JSON.stringify({ name: repo, private: true, auto_init: true, description: "Built with Wanlly" }),
    });
    if (!made.ok) throw new Error(made.data.message ? `GitHub: ${made.data.message}` : "Couldn't create the repository on GitHub.");
    info = made;
  }
  if (!info.ok) throw new Error("Couldn't reach that repository on GitHub.");
  const branch = info.data.default_branch || "main";
  const ref = await gh<{ object: { sha: string } }>(token, `/repos/${full}/git/ref/heads/${branch}`);
  if (!ref.ok) throw new Error("The repository has no main branch yet. Add a README on GitHub, then try again.");
  const tree = await gh<{ sha: string; message?: string }>(token, `/repos/${full}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ tree: files.map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.content })) }),
  });
  if (!tree.ok) throw new Error(tree.data.message ? `GitHub: ${tree.data.message}` : "GitHub didn't accept the files.");
  const commit = await gh<{ sha: string }>(token, `/repos/${full}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: tree.data.sha, parents: [ref.data.object.sha] }),
  });
  if (!commit.ok) throw new Error("GitHub didn't accept the commit.");
  const moved = await gh(token, `/repos/${full}/git/refs/heads/${branch}`, { method: "PATCH", body: JSON.stringify({ sha: commit.data.sha }) });
  if (!moved.ok) throw new Error("GitHub didn't update the branch.");
  return info.data.html_url;
}
