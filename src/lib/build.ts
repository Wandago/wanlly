import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";

/*
 * The Builder: a project made of real files, which the AI edits step by step with Claude's
 * text editor tool (view a file or folder, create a file, replace an exact passage, insert lines).
 * Files live in build_files; each step's messages in build_steps, verbatim, so the next step can
 * continue the same conversation and re-read it from the prompt cache.
 */

export const MAX_FILES = 300;
export const MAX_FILE_CHARS = 300_000;
/** A conversation this long (in characters of stored messages) is too big to keep sending. */
export const MAX_HISTORY_CHARS = 1_600_000;

export const BUILD_SYSTEM = `You are Wanlly's Builder: you build and change real multi-file software projects for students and creators, most of them in Africa, often on phones and slow connections.

You work on the project's files with the str_replace_based_edit_tool:
- Start a task by viewing "/" to see every file, then view the files you need. Don't guess what a file says.
- Make focused edits with str_replace (an exact, unique passage) or insert. Rewrite a whole file with create only when most of it changes or it is new.
- Keep files small and organised. Name entry points clearly.

What runs in the preview:
- Web apps: index.html at the root, with its CSS and JavaScript in separate files it links to (styles.css, app.js…). They're inlined for the preview and work as-is when downloaded.
- React: App.jsx (or App.tsx) as the entry, with other components in their own .jsx files; React 18 and Tailwind are provided, and imports between project files are handled. Don't import npm packages other than react.
- Server projects (Flask, Express, PHP…) can be written and downloaded; they don't run in the preview, so say how to run them.

Keep a PLAN.md at the root: the person reads it to know where the project stands and what to do. Create it at the start of a new project and update it whenever a step is finished or the plan changes. Write it for a beginner, in plain words, with these sections:
- "## Goal": one or two sentences on what the app does and who it's for.
- "## Steps": a checklist ("- [x] done", "- [ ] to do") of the build, in order, small enough that each is one request.
- "## What you need to do": anything only the person can do (create accounts, get API keys, buy a domain, test on a phone), each with numbered how-to steps.
- "## How to run it": how to open, run or deploy it, step by step.
Keep it short and current; don't let it describe work that isn't done.

Saving to GitHub is done by the app, not by you: when the person asks, tell them the GitHub panel (top right) is open for them to connect their account and pick or paste the repository. Never ask for passwords or tokens.

Work steadily until the task is done, then reply with a short summary of what changed and anything the person must do next. Ask a question instead of guessing when the request is genuinely unclear. Never invent API keys or secrets; leave clearly marked placeholders.`;

/** A model-supplied path as a clean project path, or null when it isn't allowed. */
export function cleanPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let p = raw.trim().replace(/\\/g, "/");
  try {
    p = decodeURIComponent(p);
  } catch {}
  p = p.replace(/^\/+/, "").replace(/\/+/g, "/").replace(/\/$/, "");
  if (!p) return "";
  if (p.length > 200 || /[\u0000-\u001f]/.test(p)) return null;
  const parts = p.split("/");
  if (parts.some((s) => s === ".." || s === "." || !s)) return null;
  return p;
}

export async function loadFiles(projectId: number): Promise<Map<string, string>> {
  const rows = await db().select({ path: schema.buildFiles.path, content: schema.buildFiles.content }).from(schema.buildFiles).where(eq(schema.buildFiles.projectId, projectId));
  return new Map(rows.map((r) => [r.path, r.content]));
}

async function saveFile(projectId: number, path: string, content: string) {
  await db()
    .insert(schema.buildFiles)
    .values({ projectId, path, content })
    .onConflictDoUpdate({ target: [schema.buildFiles.projectId, schema.buildFiles.path], set: { content, updatedAt: new Date() } });
}

export async function deleteFile(projectId: number, path: string) {
  await db().delete(schema.buildFiles).where(and(eq(schema.buildFiles.projectId, projectId), eq(schema.buildFiles.path, path)));
}

const numbered = (text: string, from = 1) =>
  text
    .split("\n")
    .map((l, i) => `${String(i + from).padStart(6)}\t${l}`)
    .join("\n");

export type ToolOutcome = { text: string; error?: boolean; changed?: string };

/**
 * Runs one text-editor command against the project's files. `files` is updated in place so
 * later commands in the same step see earlier changes.
 */
export async function runEditor(projectId: number, files: Map<string, string>, input: Record<string, unknown>): Promise<ToolOutcome> {
  const command = String(input.command ?? "");
  const path = cleanPath(input.path);
  if (path === null) return { text: "That path isn't allowed. Use a path inside the project, like src/app.js.", error: true };
  if (command === "view") {
    if (path === "" || ![...files.keys()].includes(path)) {
      const prefix = path ? `${path}/` : "";
      const inside = [...files.keys()].filter((f) => f.startsWith(prefix)).sort();
      if (path && !inside.length) return { text: `No file or folder at ${path}.`, error: true };
      if (!inside.length) return { text: "The project is empty. Create the first files." };
      return { text: inside.map((f) => `${f} (${files.get(f)!.length} chars)`).join("\n") };
    }
    const text = files.get(path)!;
    const range = Array.isArray(input.view_range) ? (input.view_range as unknown[]).map(Number) : null;
    if (range && range.length === 2 && range.every(Number.isFinite)) {
      const lines = text.split("\n");
      const end = range[1] === -1 ? lines.length : Math.min(lines.length, range[1]);
      return { text: numbered(lines.slice(Math.max(0, range[0] - 1), end).join("\n"), Math.max(1, range[0])) };
    }
    return { text: numbered(text) };
  }
  if (!path) return { text: "Give a file path.", error: true };
  if (command === "create") {
    const body = typeof input.file_text === "string" ? input.file_text : "";
    if (body.length > MAX_FILE_CHARS) return { text: `That file is too large (over ${MAX_FILE_CHARS.toLocaleString()} characters). Split it into smaller files.`, error: true };
    if (!files.has(path) && files.size >= MAX_FILES) return { text: `The project already has ${MAX_FILES} files, the most it can hold.`, error: true };
    files.set(path, body);
    await saveFile(projectId, path, body);
    return { text: `Wrote ${path}.`, changed: path };
  }
  const text = files.get(path);
  if (text === undefined) return { text: `${path} doesn't exist. View "/" to see the files.`, error: true };
  if (command === "str_replace") {
    const oldStr = typeof input.old_str === "string" ? input.old_str : "";
    const newStr = typeof input.new_str === "string" ? input.new_str : "";
    if (!oldStr) return { text: "old_str is empty.", error: true };
    const count = text.split(oldStr).length - 1;
    if (count === 0) return { text: `No match for old_str in ${path}. View the file and copy the passage exactly.`, error: true };
    if (count > 1) return { text: `old_str appears ${count} times in ${path}. Include more surrounding lines so it is unique.`, error: true };
    const next = text.replace(oldStr, () => newStr);
    if (next.length > MAX_FILE_CHARS) return { text: "That edit makes the file too large. Split it into smaller files.", error: true };
    files.set(path, next);
    await saveFile(projectId, path, next);
    return { text: `Edited ${path}.`, changed: path };
  }
  if (command === "insert") {
    const add = typeof input.insert_text === "string" ? input.insert_text : typeof input.new_str === "string" ? input.new_str : "";
    const at = Number(input.insert_line);
    const lines = text.split("\n");
    if (!Number.isInteger(at) || at < 0 || at > lines.length) return { text: `insert_line must be between 0 and ${lines.length}.`, error: true };
    lines.splice(at, 0, ...add.split("\n"));
    const next = lines.join("\n");
    files.set(path, next);
    await saveFile(projectId, path, next);
    return { text: `Inserted into ${path} after line ${at}.`, changed: path };
  }
  return { text: `The command "${command}" isn't available here. Use view, create, str_replace or insert.`, error: true };
}

export type StoredStep = { id: number; role: "user" | "assistant"; content: unknown; modelId: string | null; credits: number | null; createdAt: Date };

export async function loadSteps(projectId: number): Promise<StoredStep[]> {
  return (await db()
    .select({ id: schema.buildSteps.id, role: schema.buildSteps.role, content: schema.buildSteps.content, modelId: schema.buildSteps.modelId, credits: schema.buildSteps.credits, createdAt: schema.buildSteps.createdAt })
    .from(schema.buildSteps)
    .where(eq(schema.buildSteps.projectId, projectId))
    .orderBy(asc(schema.buildSteps.id))) as StoredStep[];
}

/** The project when it's this person's Builder project, or null. */
export async function ownBuild(projectId: number, userId: string) {
  const [p] = await db()
    .select({ id: schema.projects.id, name: schema.projects.name, kind: schema.projects.kind, deletedAt: schema.projects.deletedAt })
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.ownerId, userId)))
    .limit(1);
  return p && !p.deletedAt && p.kind === "build" ? p : null;
}
