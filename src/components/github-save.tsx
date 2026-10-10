"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWorkspace, type Job } from "@/lib/workspace-store";
import { Icon } from "./icon";

/** A file name for a code block with no path written before it. */
const BY_LANG: Record<string, string> = { html: "index.html", css: "styles.css", js: "app.js", javascript: "app.js", jsx: "App.jsx", tsx: "App.tsx", ts: "index.ts", py: "main.py", python: "main.py", json: "data.json", md: "README.md", sql: "schema.sql" };

/**
 * The files in a reply: each fenced code block, named by the path written on the line before it
 * ("index.html", "**src/app.js**", "`styles.css`:") or else by its language.
 */
export function filesIn(text: string): { path: string; content: string }[] {
  const out = new Map<string, string>();
  const re = /(?:^|\n)([^\n]*)\n(```|~~~)([\w+-]*)[^\n]*\n([\s\S]*?)\n\2/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const named = m[1].match(/([\w./-]+\.[A-Za-z0-9]{1,6})/)?.[1];
    const path = (named && !/^https?:/.test(named) ? named.replace(/^\.?\/+/, "") : BY_LANG[m[3].toLowerCase()]) ?? null;
    if (path && !/^(bash|sh|shell|console|text)$/i.test(m[3])) out.set(path, m[4]);
  }
  return [...out].map(([path, content]) => ({ path, content }));
}

const LINK = /https?:\/\/github\.com\/[\w-]+\/[\w.-]+/i;

/**
 * "Save to GitHub" under a reply that has code (or anywhere in a chat that asked for GitHub):
 * the conversation's code becomes a Builder project and its GitHub panel opens, with the
 * repository link already filled in when the person gave one.
 */
export function GithubSave({ job }: { job: Job }) {
  const { jobs } = useWorkspace();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // This reply's code, or the latest earlier reply's in the same conversation.
  const upTo = jobs.slice(0, jobs.findIndex((j) => j.id === job.id) + 1);
  const source = [...upTo].reverse().find((j) => j.text && filesIn(j.text).length);
  const asked = /\bgit\s?hub\b/i.test(job.prompt) || LINK.test(job.prompt);
  if (!source || (!asked && source.id !== job.id)) return null;
  const link = [...upTo].reverse().map((j) => j.prompt.match(LINK)?.[0]).find(Boolean) ?? "";

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const files = filesIn(source.text ?? "");
      const title = (source.text ?? "").match(/<title>([^<]{1,60})<\/title>/i)?.[1] ?? source.prompt.slice(0, 60) ?? "My project";
      const made = await fetch("/api/build", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: title }) });
      const b = await made.json().catch(() => ({}));
      if (!made.ok || !b.id) throw new Error(b.error ?? "Couldn't start the project. Try again.");
      for (const f of files) await fetch(`/api/build/${b.id}/files`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
      router.push(`/build/${b.id}?github=${encodeURIComponent(link || "1")}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the project. Try again.");
      setBusy(false);
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${asked ? "rounded-xl border border-line bg-surface px-3 py-2.5" : ""}`}>
      {asked && <span className="text-[13px] text-muted">Wanlly can save this to your GitHub for you.</span>}
      <button
        type="button"
        disabled={busy}
        onClick={save}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50 ${asked ? "ml-auto bg-fg text-bg hover:opacity-90" : "border border-line text-muted hover:border-faint hover:text-fg"}`}
      >
        <Icon name="github" size={14} /> {busy ? "Opening…" : "Save to GitHub"}
      </button>
      {error && <span className="w-full text-xs text-bad">{error}</span>}
    </div>
  );
}
