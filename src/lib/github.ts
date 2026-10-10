import "server-only";
import { clerk } from "./session";

/*
 * Saving a Builder project to the person's own GitHub, with the GitHub account they connected
 * through Clerk. It needs the "repo" permission (asked for the first time they press the
 * button). The token stays on the server; it is only used for this person's own repositories.
 */

export const GITHUB_SCOPE = "repo";
const API = "https://api.github.com";
/** The description Wanlly gives repositories it creates; only those are written to. */
const MARK = "Built with Wanlly";

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

/**
 * Credits Wanlly on every commit it makes, with GitHub's co-author line. WANLLY_GITHUB_COAUTHOR
 * (Cloudflare setting) is the GitHub account's "Name <ID+username@users.noreply.github.com>", so
 * GitHub shows its avatar; without it the credit is plain text.
 */
function withCoauthor(message: string) {
  const who = process.env.WANLLY_GITHUB_COAUTHOR?.trim() || "Wanlly <noreply@wanlly.africa>";
  return `${message}\n\nCo-authored-by: ${who}`;
}

/** UTF-8 text as base64, for GitHub's file API. */
function toBase64(text: string) {
  let bin = "";
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** A repository name GitHub accepts. */
export const repoName = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "wanlly-app";

/**
 * What the person typed: a link (https://github.com/owner/repo), "owner/repo", or just a name for
 * a repository of their own. Null when it can't be a repository.
 */
export function parseRepo(input: string): { owner?: string; name: string } | null {
  const t = input.trim().replace(/\.git$/, "").replace(/\/+$/, "");
  if (!t) return null;
  const link = t.match(/github\.com[/:]([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})/i);
  if (link) return { owner: link[1], name: link[2] };
  const pair = t.match(/^([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})$/);
  if (pair) return { owner: pair[1], name: pair[2] };
  return { name: repoName(t) };
}

/** The GitHub account the token belongs to, or null when GitHub refuses it. */
export async function githubLogin(token: string): Promise<string | null> {
  const me = await gh<{ login: string }>(token, "/user");
  return me.ok ? me.data.login : null;
}

/**
 * Commits the project's files to a repository's main branch and returns its address.
 * - A name of the person's own that doesn't exist yet: a private repository is created.
 * - A repository Wanlly created: it's kept identical to the project (deleted files go too).
 * - Any other repository they can push to: the files are added or updated in one commit and
 *   everything else in it is left alone, so nothing of theirs is lost (and history keeps all).
 */
export async function pushToGithub(token: string, target: { owner?: string; name: string }, files: { path: string; content: string }[], message: string): Promise<string> {
  const login = await githubLogin(token);
  if (!login) throw new Error("GitHub didn't accept the connection. Connect GitHub again.");
  const owner = target.owner ?? login;
  const full = `${owner}/${target.name}`;
  let info = await gh<{ default_branch: string; html_url: string; description?: string | null; permissions?: { push?: boolean }; message?: string }>(token, `/repos/${full}`);
  if (info.status === 404) {
    if (owner.toLowerCase() !== login.toLowerCase())
      throw new Error(`Couldn't find ${full}, or your GitHub account (${login}) can't see it. Check the link, or ask the owner to add you.`);
    const made = await gh<{ default_branch: string; html_url: string; description?: string | null; message?: string }>(token, "/user/repos", {
      method: "POST",
      body: JSON.stringify({ name: target.name, private: true, auto_init: true, description: MARK }),
    });
    if (!made.ok) throw new Error(made.data.message ? `GitHub: ${made.data.message}` : "Couldn't create the repository on GitHub.");
    info = made;
  } else if (info.ok && info.data.permissions && !info.data.permissions.push) {
    throw new Error(`Your GitHub account (${login}) can see ${full} but can't save to it. Ask the owner for write access.`);
  }
  if (!info.ok) throw new Error("Couldn't reach that repository on GitHub.");
  const mirror = info.data.description === MARK;
  const branch = info.data.default_branch || "main";
  let ref = await gh<{ object: { sha: string } }>(token, `/repos/${full}/git/ref/heads/${branch}`);
  if (!ref.ok) {
    // A brand-new empty repository has no branch yet, and GitHub won't take a set of files into
    // it. Writing one file the simple way starts the branch; the rest follow in the commit below.
    const first = files.find((f) => /^readme\.md$/i.test(f.path)) ?? files[0];
    const started = await gh<{ message?: string }>(token, `/repos/${full}/contents/${first.path.split("/").map(encodeURIComponent).join("/")}`, {
      method: "PUT",
      body: JSON.stringify({ message: withCoauthor(message), content: toBase64(first.content), branch }),
    });
    if (!started.ok) throw new Error(started.data.message ? `GitHub: ${started.data.message}` : "Couldn't start the empty repository.");
    ref = await gh<{ object: { sha: string } }>(token, `/repos/${full}/git/ref/heads/${branch}`);
    if (!ref.ok) throw new Error("GitHub didn't create the branch. Try again in a moment.");
  }
  const parent = await gh<{ tree: { sha: string } }>(token, `/repos/${full}/git/commits/${ref.data.object.sha}`);
  const tree = await gh<{ sha: string; message?: string }>(token, `/repos/${full}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      // On top of what's there, unless the repository is one Wanlly keeps identical to the project.
      ...(!mirror && parent.ok ? { base_tree: parent.data.tree.sha } : {}),
      tree: files.map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.content })),
    }),
  });
  if (!tree.ok) throw new Error(tree.data.message ? `GitHub: ${tree.data.message}` : "GitHub didn't accept the files.");
  const commit = await gh<{ sha: string }>(token, `/repos/${full}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message: withCoauthor(message), tree: tree.data.sha, parents: [ref.data.object.sha] }),
  });
  if (!commit.ok) throw new Error("GitHub didn't accept the commit.");
  const moved = await gh(token, `/repos/${full}/git/refs/heads/${branch}`, { method: "PATCH", body: JSON.stringify({ sha: commit.data.sha }) });
  if (!moved.ok) throw new Error("GitHub didn't update the branch. If the branch is protected, save to another repository.");
  return info.data.html_url;
}

/** Folders and files that aren't the project's own source (installed packages, build output). */
const SKIP_DIR = /(^|\/)(node_modules|\.git|\.next|dist|build|out|vendor|coverage|\.venv|venv|__pycache__|\.open-next|\.wrangler)\//;
const SKIP_FILE = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|\.DS_Store)$|\.(png|jpe?g|gif|webp|avif|ico|bmp|svgz|woff2?|ttf|otf|eot|mp3|mp4|mov|webm|wav|ogg|pdf|zip|gz|tgz|rar|7z|jar|exe|dll|so|dylib|wasm|bin|psd|sketch|fig)$/i;

/**
 * A repository's text files, read from GitHub's zip download (one request, which matters on
 * Cloudflare's free plan). Installed packages, build output, lock files and binaries are left
 * out, and so is anything past the size and count limits; `skipped` says how many.
 */
export async function readRepo(token: string, target: { owner?: string; name: string }, limits: { maxFiles: number; maxFileChars: number; maxTotalChars: number }) {
  const { listZip } = await import("./unzip");
  const login = await githubLogin(token);
  if (!login) throw new Error("GitHub didn't accept the connection. Connect GitHub again.");
  const full = `${target.owner ?? login}/${target.name}`;
  const info = await gh<{ default_branch: string; html_url: string; size?: number }>(token, `/repos/${full}`);
  if (!info.ok) throw new Error(`Couldn't find ${full}, or your GitHub account (${login}) can't see it. Check the link.`);
  if ((info.data.size ?? 0) > 60_000) throw new Error("That repository is too big to open here (over 60 MB). Try a smaller one.");
  const r = await fetch(`${API}/repos/${full}/zipball/${encodeURIComponent(info.data.default_branch || "main")}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "Wanlly" },
  });
  if (r.status === 404) throw new Error("That repository is empty, so there's nothing to open yet. Start fresh, then save into it.");
  if (!r.ok) throw new Error("GitHub didn't send the repository's files. Try again in a moment.");
  const zip = new Uint8Array(await r.arrayBuffer());
  const files: { path: string; content: string }[] = [];
  let total = 0;
  let skipped = 0;
  const utf8 = new TextDecoder("utf-8", { fatal: true });
  for (const e of listZip(zip)) {
    // Paths in GitHub's zip start with a "owner-repo-sha/" folder.
    const path = e.path.slice(e.path.indexOf("/") + 1);
    if (!path || SKIP_DIR.test(path) || SKIP_FILE.test(path)) continue;
    if (e.size > limits.maxFileChars || files.length >= limits.maxFiles || total + e.size > limits.maxTotalChars) {
      skipped++;
      continue;
    }
    let text: string;
    try {
      text = utf8.decode(await e.read());
    } catch {
      continue; // not text
    }
    if (text.includes("\u0000")) continue;
    files.push({ path, content: text });
    total += text.length;
  }
  return { files, skipped, url: info.data.html_url, branch: info.data.default_branch || "main" };
}

/** Repositories the person can push to, most recently changed first (up to 100). */
export async function githubRepos(token: string) {
  const r = await gh<{ full_name: string; html_url: string; private: boolean; pushed_at: string | null; permissions?: { push?: boolean } }[]>(
    token,
    "/user/repos?sort=pushed&per_page=100&affiliation=owner,collaborator,organization_member",
  );
  if (!r.ok || !Array.isArray(r.data)) throw new Error("GitHub didn't list the repositories");
  return r.data.filter((x) => x.permissions?.push !== false).map((x) => ({ name: x.full_name, url: x.html_url, private: x.private, pushedAt: x.pushed_at }));
}
