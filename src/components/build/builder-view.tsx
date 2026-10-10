"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MODELS, isLive } from "@/lib/catalog";
import { buildPreview, type BuildFile } from "@/lib/build-preview";
import { saveBlob } from "@/lib/export";
import { SAY } from "@/lib/messages";
import { zipFiles } from "@/lib/runnable";
import { useLocalSetting } from "@/lib/use-local-setting";
import { accountFrom, useWorkspace } from "@/lib/workspace-store";
import { Icon } from "../icon";
import { Markdown } from "../markdown";
import { SpinLoader } from "../spin-mark";
import { BuildShip } from "./build-ship";

/*
 * The Builder: files on the left, the live preview or a file's code in the middle, and the
 * conversation on the right. Each request runs as a series of steps (/api/build/[id]/step), one
 * at a time, so every step shows its cost and Stop works between and during steps.
 */

type Step = { id: number; role: "user" | "assistant"; text: string; edits?: { command: string; path: string }[]; modelId?: string | null; credits?: number | null };
type Live = { text: string; edits: { command: string; path: string; ok: boolean }[] };

/** Steps one request may take before asking the person whether to keep going. */
const STEP_LIMIT = 25;
const VERB: Record<string, string> = { view: "Read", create: "Wrote", str_replace: "Edited", insert: "Edited" };

export function BuilderView({ id }: { id: number }) {
  const { providers, dispatch } = useWorkspace();
  const [name, setName] = useState("");
  const [files, setFiles] = useState<BuildFile[] | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [missing, setMissing] = useState(false);
  const [live, setLive] = useState<Live | null>(null);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<{ text: string; resume?: boolean } | null>(null);
  const [draft, setDraft] = useState("");
  const [modelId, setModelId] = useLocalSetting("wanlly-build-model", "sonnet");
  const [smart, setSmart] = useLocalSetting("wanlly-build-smart", "on");
  const [pane, setPane] = useState<"chat" | "files" | "preview">("chat");
  const [view, setView] = useState<"preview" | "code" | "plan">("preview");
  const [open, setOpen] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const started = useRef(false);

  const claude = useMemo(() => MODELS.filter((m) => m.provider === "anthropic" && isLive(m, providers)), [providers]);
  const model = claude.find((m) => m.id === modelId) ?? claude.find((m) => m.id === "sonnet") ?? claude[0];

  const load = useCallback(async () => {
    const r = await fetch(`/api/build/${id}`, { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return setMissing(true);
    const b = await r.json();
    setName(b.project.name);
    setFiles(b.files);
    setSteps(b.steps);
    if (b.pending && !abort.current) setNotice((n) => n ?? { text: "The last request stopped part-way.", resume: true });
    return b as { steps: Step[] };
  }, [id]);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  /** Runs one request as steps until the AI is done, it fails, the person stops, or the step limit. */
  const run = useCallback(
    async (message: string) => {
      if (!model || running) return;
      setRunning(true);
      setNotice(null);
      setErrors([]);
      const ctrl = new AbortController();
      abort.current = ctrl;
      let first = true;
      try {
        for (let i = 0; i < STEP_LIMIT; i++) {
          // Smart building: the chosen model plans the first step, Sonnet does the rest.
          const stepModel = smart === "on" && !first && model.id !== "haiku" && claude.some((m) => m.id === "sonnet") ? "sonnet" : model.id;
          setLive({ text: "", edits: [] });
          const r = await fetch(`/api/build/${id}/step`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message: first ? message : "", modelId: stepModel, jobId: crypto.randomUUID() }),
            signal: ctrl.signal,
          });
          first = false;
          if (!r.ok || !r.body || !(r.headers.get("content-type") ?? "").includes("ndjson")) {
            const b = await r.json().catch(() => ({}));
            const act = accountFrom(b);
            if (act) dispatch(act);
            if (b.done) break;
            setNotice({ text: b.error ?? SAY.busy });
            break;
          }
          const reader = r.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          let finished = false;
          let failed = false;
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let nl;
            while ((nl = buf.indexOf("\n")) >= 0) {
              const line = buf.slice(0, nl);
              buf = buf.slice(nl + 1);
              if (!line.trim()) continue;
              const ev = JSON.parse(line);
              if (ev.type === "text") setLive((l) => (l ? { ...l, text: l.text + ev.text } : l));
              if (ev.type === "edit") setLive((l) => (l ? { ...l, edits: [...l.edits, { command: ev.command, path: ev.path, ok: ev.ok }] } : l));
              if (ev.type === "done" || ev.type === "error") {
                const act = accountFrom(ev);
                if (act) dispatch(act);
              }
              if (ev.type === "done") finished = ev.done;
              if (ev.type === "error") {
                failed = true;
                setNotice({ text: ev.message });
              }
            }
          }
          await load();
          setLive(null);
          if (finished || failed) break;
          if (i === STEP_LIMIT - 1) setNotice({ text: `Paused after ${STEP_LIMIT} steps so nothing runs away with your credits.`, resume: true });
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") setNotice({ text: SAY.offline, resume: true });
        else setNotice({ text: "Stopped. Your files are saved as they are.", resume: true });
        await load();
      } finally {
        setLive(null);
        setRunning(false);
        abort.current = null;
      }
    },
    [id, model, running, smart, claude, dispatch, load],
  );

  // A new app started from the Builder's home page carries its first request over.
  useEffect(() => {
    if (started.current || !files || steps.length || !model) return;
    let first: string | null = null;
    try {
      first = sessionStorage.getItem(`wanlly-build-first-${id}`);
      sessionStorage.removeItem(`wanlly-build-first-${id}`);
    } catch {}
    started.current = true;
    if (first) queueMicrotask(() => void run(first!));
  }, [files, steps.length, model, id, run]);

  // The preview reports its errors; the Builder can hand them back to fix.
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const m = e.data as { wanllyPreview?: string; message?: string };
      if (m?.wanllyPreview === "error" && m.message) setErrors((xs) => (xs.includes(m.message!) ? xs : [...xs, m.message!].slice(-8)));
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);

  const preview = useMemo(() => (files ? buildPreview(files) : ""), [files]);
  const current = files?.find((f) => f.path === open) ?? null;
  const plan = files?.find((f) => f.path.toLowerCase() === "plan.md") ?? null;
  // With nothing to preview (a server app, or no page yet), the plan is the most useful thing to show.
  const shown = view === "preview" && !preview && plan ? "plan" : view;

  if (missing) return <main className="grid h-full place-items-center p-6 text-center text-muted">{SAY.notFound}</main>;
  if (!files) return <main className="grid h-full place-items-center"><SpinLoader size={56} label="Opening your app" /></main>;

  const send = () => {
    const text = draft.trim();
    if (!text || running) return;
    setDraft("");
    void run(text);
  };
  const runChecks = async () => {
    setChecking(true);
    setReport(null);
    try {
      const r = await fetch(`/api/build/${id}/check`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId: crypto.randomUUID() }) });
      const b = await r.json().catch(() => ({}));
      const act = accountFrom(b);
      if (act) dispatch(act);
      if (!r.ok) setNotice({ text: b.error ?? SAY.busy });
      else setReport(b.report);
    } catch {
      setNotice({ text: SAY.offline });
    } finally {
      setChecking(false);
    }
  };
  const fixErrors = () => void run(`The preview shows these errors:\n${errors.map((e) => `- ${e}`).join("\n")}\nFind the cause and fix it.`);

  const chat = (
    <section className="flex min-h-0 flex-1 flex-col border-line md:border-l">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!steps.length && !live && (
          <p className="text-sm text-muted">Describe what to build or change. The AI works in steps: it reads the files it needs, edits them, and checks the result.</p>
        )}
        <ol className="flex flex-col gap-3">
          {steps.map((s) => (
            <li key={s.id} className={s.role === "user" ? "self-end rounded-2xl bg-hover px-3.5 py-2 text-sm" : "flex flex-col gap-1.5 text-sm"}>
              {s.role === "user" ? (
                <span className="whitespace-pre-wrap">{s.text}</span>
              ) : (
                <>
                  {s.text && <Markdown text={s.text} />}
                  {!!s.edits?.length && <EditList edits={s.edits} />}
                  {s.credits ? <small className="text-[11px] text-faint">{s.credits} credits · {MODELS.find((m) => m.id === s.modelId)?.name ?? s.modelId}</small> : null}
                </>
              )}
            </li>
          ))}
          {live && (
            <li className="flex flex-col gap-1.5 text-sm">
              {live.text && <Markdown text={live.text} />}
              {!!live.edits.length && <EditList edits={live.edits} />}
              <span className="flex items-center gap-2 text-xs text-muted">
                <SpinLoader size={14} label="" /> Working…
              </span>
            </li>
          )}
        </ol>
      </div>
      {report && (
        <div className="mx-4 mb-2 flex max-h-[45%] flex-col gap-2 overflow-y-auto rounded-xl border border-line p-3 text-[13px]">
          <b className="font-semibold">Check report</b>
          <Markdown text={report} />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={running}
              onClick={() => {
                const text = report;
                setReport(null);
                void run(`I ran the project's checks in a sandbox. Here is the report:\n\n${text}\n\nFix what failed.`);
              }}
              className="rounded-lg bg-fg px-2.5 py-1 text-xs font-semibold text-bg disabled:opacity-50"
            >
              Ask the AI to fix
            </button>
            <button type="button" onClick={() => setReport(null)} className="rounded-lg px-2.5 py-1 text-xs text-muted">
              Dismiss
            </button>
          </div>
        </div>
      )}
      {notice && (
        <div className="mx-4 mb-2 flex flex-wrap items-center gap-2 rounded-xl bg-hover px-3 py-2 text-[13px]">
          <span className="min-w-0 flex-1">{notice.text}</span>
          {notice.resume && (
            <button type="button" onClick={() => void run("")} className="font-medium underline-offset-2 hover:underline">
              Continue
            </button>
          )}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="m-3 flex flex-col gap-2 rounded-2xl border border-line bg-surface p-2.5"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder={steps.length ? "What should change next?" : "What do you want to build?"}
          className="w-full resize-none bg-transparent px-1 text-sm outline-none placeholder:text-faint"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Model" value={model?.id ?? ""} onChange={(e) => setModelId(e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1 text-xs">
            {claude.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-muted" title="The model you pick plans the first step; Sonnet does the rest, for a fraction of the cost.">
            <input type="checkbox" checked={smart === "on"} onChange={(e) => setSmart(e.target.checked ? "on" : "off")} />
            Smart building
          </label>
          {running ? (
            <button type="button" onClick={() => abort.current?.abort()} className="ml-auto rounded-lg border border-line px-3 py-1.5 text-xs font-semibold">
              Stop
            </button>
          ) : (
            <button type="submit" disabled={!draft.trim() || !model} className="ml-auto rounded-lg bg-fg px-3 py-1.5 text-xs font-semibold text-bg disabled:opacity-50">
              Build
            </button>
          )}
        </div>
        {!model && <p className="text-xs text-bad">The Builder needs a Claude model, and none is switched on yet.</p>}
      </form>
    </section>
  );

  const fileList = (
    <nav aria-label="Files" className="flex min-h-0 flex-col overflow-y-auto py-2 md:w-[220px] md:shrink-0 md:border-r md:border-line">
      <div className="flex items-center justify-between px-3 pb-1 text-[11px] font-medium tracking-[0.08em] text-faint uppercase">
        Files <span className="font-mono normal-case">{files.length}</span>
      </div>
      {files.length ? (
        files.map((f) => (
          <button
            key={f.path}
            type="button"
            onClick={() => {
              setOpen(f.path);
              setView("code");
              setPane("preview");
            }}
            className={`truncate px-3 py-1 text-left font-mono text-xs ${open === f.path && view === "code" ? "bg-hover text-fg" : "text-muted hover:text-fg"}`}
            title={f.path}
          >
            {f.path}
          </button>
        ))
      ) : (
        <p className="px-3 text-xs text-faint">No files yet.</p>
      )}
    </nav>
  );

  const stage = (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-line px-3 py-1.5 text-xs">
        {(plan ? (["preview", "code", "plan"] as const) : (["preview", "code"] as const)).map((v) => (
          <button key={v} type="button" onClick={() => setView(v)} className={`rounded-md px-2 py-1 capitalize ${shown === v ? "bg-hover font-medium text-fg" : "text-muted"}`}>
            {v}
          </button>
        ))}
        {view === "code" && current && <span className="ml-2 truncate font-mono text-faint">{current.path}</span>}
      </div>
      {errors.length > 0 && view === "preview" && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-bad/5 px-3 py-2 text-[13px]">
          <span className="text-bad">
            The preview shows {errors.length} error{errors.length > 1 ? "s" : ""}: <span className="font-mono text-xs">{errors[0]}</span>
          </span>
          <button type="button" disabled={running} onClick={fixErrors} className="ml-auto rounded-lg bg-fg px-2.5 py-1 text-xs font-semibold text-bg disabled:opacity-50">
            Ask the AI to fix
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1">
        {shown === "plan" && plan ? (
          <div className="h-full overflow-y-auto px-6 py-5 text-[14px]">
            <div className="mx-auto max-w-[680px]">
              <Markdown text={plan.content} />
            </div>
          </div>
        ) : shown === "preview" ? (
          preview ? (
            <iframe key={preview.length} ref={frame} title="Preview" srcDoc={preview} sandbox="allow-scripts allow-modals allow-forms allow-popups" className="block size-full border-0 bg-white" />
          ) : (
            <div className="grid h-full place-items-center p-6 text-center text-sm text-muted">
              {files.length ? "This project doesn't have a page a browser can run (for example a server app). Download it to run it." : "The preview appears here once there are files."}
            </div>
          )
        ) : current ? (
          <FileEditor key={current.path} id={id} file={current} onSaved={load} />
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted">Pick a file on the left.</div>
        )}
      </div>
    </section>
  );

  return (
    <main className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <Link href="/build" aria-label="All apps" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg">
          <Icon name="grid" size={16} />
        </Link>
        <input
          aria-label="App name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => fetch(`/api/build/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) })}
          className="min-w-0 flex-1 truncate bg-transparent font-display text-base font-semibold outline-none"
        />
        <BuildShip id={id} files={files} name={name} />
        <button
          type="button"
          disabled={running || checking || !files.length}
          onClick={runChecks}
          title="Runs the project in a sandbox: installs what it can, builds, runs tests, and reports what failed"
          className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:border-faint disabled:opacity-50"
        >
          {checking ? "Checking…" : "Run checks"}
        </button>
        <button
          type="button"
          disabled={!files.length}
          onClick={() => saveBlob(zipFiles(files.map((f) => ({ name: f.path, code: f.content }))), `${(name || "app").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.zip`)}
          className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:border-faint disabled:opacity-50"
        >
          Download
        </button>
        <button
          type="button"
          disabled={running}
          title="Clears the conversation so the next request starts fresh (and costs less). Your files stay."
          onClick={async () => {
            if (!window.confirm("Start a new thread? The conversation is cleared; your files stay as they are.")) return;
            await fetch(`/api/build/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "new-thread" }) });
            await load();
          }}
          className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:border-faint"
        >
          New thread
        </button>
      </header>
      <div className="flex border-b border-line md:hidden">
        {(["chat", "files", "preview"] as const).map((p) => (
          <button key={p} type="button" onClick={() => setPane(p)} className={`flex-1 py-2 text-xs capitalize ${pane === p ? "border-b-2 border-fg font-semibold" : "text-muted"}`}>
            {p}
          </button>
        ))}
      </div>
      <div className="hidden min-h-0 flex-1 md:flex">
        {fileList}
        {stage}
        <div className="flex w-[380px] shrink-0 flex-col">{chat}</div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col md:hidden">{pane === "chat" ? chat : pane === "files" ? fileList : stage}</div>
    </main>
  );
}

function EditList({ edits }: { edits: { command: string; path: string; ok?: boolean }[] }) {
  return (
    <ul className="flex flex-col gap-0.5 rounded-lg border border-line px-2.5 py-1.5 font-mono text-[11px] text-muted">
      {edits.map((e, i) => (
        <li key={i} className={e.ok === false ? "text-bad" : ""}>
          {VERB[e.command] ?? e.command} {e.path || "/"}
          {e.ok === false ? " · didn't apply" : ""}
        </li>
      ))}
    </ul>
  );
}

/** A file's code, editable by hand. */
function FileEditor({ id, file, onSaved }: { id: number; file: BuildFile; onSaved: () => void }) {
  const [text, setText] = useState(file.content);
  const [state, setState] = useState("");
  const dirty = text !== file.content;
  return (
    <div className="flex h-full flex-col">
      <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} className="min-h-0 flex-1 resize-none bg-code p-3 font-mono text-[12px] leading-relaxed outline-none" />
      <div className="flex items-center gap-2 border-t border-line px-3 py-1.5 text-xs">
        <span className="text-faint">{state}</span>
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm(`Delete ${file.path}?`)) return;
            await fetch(`/api/build/${id}/files?path=${encodeURIComponent(file.path)}`, { method: "DELETE" });
            onSaved();
          }}
          className="ml-auto rounded-md px-2 py-1 text-muted hover:text-bad"
        >
          Delete
        </button>
        <button
          type="button"
          disabled={!dirty}
          onClick={async () => {
            setState("Saving…");
            const r = await fetch(`/api/build/${id}/files`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: file.path, content: text }) }).catch(() => null);
            setState(r?.ok ? "Saved" : SAY.offline);
            if (r?.ok) onSaved();
          }}
          className="rounded-md bg-fg px-2.5 py-1 font-semibold text-bg disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  );
}
