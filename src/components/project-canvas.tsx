"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { saveBlob } from "@/lib/export";
import { findProject, findServerProject, previewHtml, projectFileName, zipFiles, type Project, type ServerProject } from "@/lib/runnable";
import { useWorkspace, type Job } from "@/lib/workspace-store";
import { Icon } from "./icon";

/*
 * The canvas: a live preview of what a reply builds, next to the chat (full screen on phones).
 * The page runs in a sandboxed frame with its own origin, so its code can't reach Wanlly or the
 * person's account. It follows the reply while it's written and can be downloaded as one file.
 */

const CanvasContext = createContext<{ openId: string | null; open: (id: string | null) => void } | null>(null);

export function CanvasProvider({ children }: { children: ReactNode }) {
  const [openId, open] = useState<string | null>(null);
  const value = useMemo(() => ({ openId, open }), [openId]);
  return <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>;
}

export const useCanvas = () => useContext(CanvasContext);

export const downloadProject = (p: Project) => saveBlob(new Blob([p.html], { type: "text/html" }), projectFileName(p));

/** Each reply opens the canvas by itself once, when its first runnable code appears. */
const autoOpened = new Set<string>();

/** Under a reply with runnable code: what it is, and buttons to preview or download it. */
export function ProjectCard({ job }: { job: Job }) {
  const canvas = useCanvas();
  const project = useMemo(() => findProject(job.text ?? ""), [job.text]);
  const streaming = job.status === "working";
  useEffect(() => {
    if (!project || !canvas || !streaming || job.tool !== "code" || autoOpened.has(job.id)) return;
    autoOpened.add(job.id);
    canvas.open(job.id);
  }, [project, canvas, streaming, job.id, job.tool]);
  if (!project) return <ServerCard job={job} />;
  const open = canvas?.openId === job.id;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-hover text-muted">
        <Icon name="code" size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <b className="block truncate text-[14px] font-semibold">{project.title}</b>
        <span className="text-xs text-muted">
          {project.kind === "react" ? "React app" : project.files.length > 1 ? `${project.files.length} files in one page` : "Web page"} ·{" "}
          {project.complete && !streaming ? "Ready to run" : "Being written…"}
        </span>
      </div>
      <div className="flex gap-1.5">
        {canvas && (
          <button type="button" onClick={() => canvas.open(open ? null : job.id)} className="rounded-[9px] border border-line px-3 py-1.5 text-[13px] font-medium hover:bg-hover">
            {open ? "Close preview" : "Preview"}
          </button>
        )}
        <button
          type="button"
          disabled={!project.complete || streaming}
          onClick={() => downloadProject(project)}
          className="flex items-center gap-1.5 rounded-[9px] bg-fg px-3 py-1.5 text-[13px] font-semibold text-bg disabled:opacity-50"
        >
          <Icon name="down" size={14} /> .html
        </button>
      </div>
    </div>
  );
}

const RUN: Record<string, string> = {
  "Python (Flask)": "Unzip, then run: pip install flask && python app.py, and open http://localhost:5000",
  "Python (FastAPI)": "Unzip, then run: pip install fastapi uvicorn && uvicorn main:app --reload",
  "Python (Django)": "Unzip, then run: pip install django && python manage.py runserver",
  Python: "Unzip, then run the main .py file with Python 3.",
  "Node.js (Express)": "Unzip, then run: npm install && node server.js (or the main .js file)",
  "Node.js": "Unzip, then run: npm install && npm start",
  PHP: "Unzip, then run: php -S localhost:8000",
};

/** Code that needs a server to run (Flask, Express, PHP…): no browser preview, but every file in one zip. */
function ServerCard({ job }: { job: Job }) {
  const p: ServerProject | null = useMemo(() => findServerProject(job.text ?? ""), [job.text]);
  if (!p) return null;
  const ready = p.complete && job.status !== "working";
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-hover text-muted">
          <Icon name="folder" size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[14px] font-semibold">
            {p.files.length} files · {p.stack}
          </b>
          <span className="text-xs text-muted">{ready ? "Runs on your computer, not in the browser, so there's no live preview." : "Being written…"}</span>
        </div>
        <button
          type="button"
          disabled={!ready}
          onClick={() => saveBlob(zipFiles(p.files), `${p.title}.zip`)}
          className="flex items-center gap-1.5 rounded-[9px] bg-fg px-3 py-1.5 text-[13px] font-semibold text-bg disabled:opacity-50"
        >
          <Icon name="down" size={14} /> .zip
        </button>
      </div>
      {ready && <p className="font-mono text-[11px] text-muted">{RUN[p.stack] ?? "Unzip and follow the steps in the reply."}</p>}
    </div>
  );
}

/** The canvas panel itself, shown when a reply's preview is open. */
export function ProjectCanvas() {
  const canvas = useCanvas();
  const { jobs } = useWorkspace();
  const job = jobs.find((j) => j.id === canvas?.openId);
  const project = useMemo(() => (job ? findProject(job.text ?? "") : null), [job]);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [reload, setReload] = useState(0);
  const [doc, setDoc] = useState("");
  const streaming = job?.status === "working";

  // While the reply is being written, the preview catches up at most every 1.5 s (a steady pace,
  // even when words arrive non-stop). A finished reply shows straight away.
  const latest = useRef("");
  const pending = useRef<number | null>(null);
  const last = useRef(0);
  useEffect(() => {
    latest.current = project?.html ?? "";
    if (!streaming || !project || pending.current) return;
    pending.current = window.setTimeout(
      () => {
        pending.current = null;
        last.current = Date.now();
        setDoc(latest.current);
      },
      Math.max(0, 1500 - (Date.now() - last.current)),
    );
  }, [project, streaming]);
  useEffect(
    () => () => {
      if (pending.current) window.clearTimeout(pending.current);
      pending.current = null;
    },
    [],
  );
  const shown = useMemo(() => previewHtml(streaming ? doc : (project?.html ?? "")), [streaming, doc, project]);

  if (!canvas?.openId || !job || !project) return null;
  const tab = (k: "preview" | "code", label: string) => (
    <button type="button" aria-pressed={view === k} onClick={() => setView(k)} className={`rounded-lg px-2.5 py-1 text-[13px] ${view === k ? "bg-bg font-medium shadow-soft" : "text-muted"}`}>
      {label}
    </button>
  );
  return (
    <section aria-label={`${project.title} preview`} className="flex min-h-0 min-w-0 flex-col border-line bg-side max-md:fixed max-md:inset-0 max-md:z-40 md:max-2xl:absolute md:max-2xl:inset-0 md:max-2xl:z-30 2xl:border-l">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2">
        <b className="min-w-0 flex-1 truncate text-[14px] font-semibold">{project.title}</b>
        <div className="flex rounded-[10px] bg-hover p-0.5">
          {tab("preview", "Preview")}
          {tab("code", "Code")}
        </div>
        <button type="button" aria-label="Reload preview" onClick={() => setReload((n) => n + 1)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover">
          <Icon name="redo" size={15} />
        </button>
        <button
          type="button"
          aria-label="Download as one HTML file"
          disabled={!project.complete || streaming}
          onClick={() => downloadProject(project)}
          className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover disabled:opacity-40"
        >
          <Icon name="down" size={15} />
        </button>
        <button type="button" aria-label="Close preview" onClick={() => canvas.open(null)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover">
          <Icon name="x" size={15} />
        </button>
      </header>
      <div className="relative min-h-0 flex-1">
        {view === "preview" ? (
          <iframe
            // A fresh load when the reply finishes, so scripts that ran on a half-written page start clean.
            key={`${job.id}:${reload}:${streaming ? "live" : "done"}`}
            title={`${project.title} preview`}
            sandbox="allow-scripts allow-modals allow-forms allow-popups"
            referrerPolicy="no-referrer"
            srcDoc={shown}
            className="absolute inset-0 h-full w-full bg-white"
          />
        ) : (
          <pre className="absolute inset-0 overflow-auto p-4 font-mono text-[12px] leading-[1.55] whitespace-pre-wrap">{project.html}</pre>
        )}
        {streaming && <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted shadow-soft">Writing… the preview follows along</span>}
      </div>
      <footer className="border-t border-line px-3 py-2 text-xs text-faint">
        {project.kind === "react" ? "Downloads as one HTML file that loads React from the internet when opened." : "Downloads as one HTML file: open it in any browser to run it."}
      </footer>
    </section>
  );
}
