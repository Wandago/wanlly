"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { MODELS, type ToolId } from "@/lib/catalog";
import { useWorkspace } from "@/lib/workspace-store";
import { Icon } from "../icon";
import { PageFrame, Panel, btnDark, btnGhost, chip } from "./page-frame";

export type DesignKind = "slides" | "design" | "codebase" | "system";

export type Project = {
  id: number;
  name: string;
  tool: ToolId;
  kind?: DesignKind | null;
  about: string;
  instructions: string;
  modelId: string;
  createdAt: string;
  updatedAt: string;
};

const LABEL: Record<ToolId, string> = { chat: "Chat", code: "Code", design: "Design", images: "Images" };
const TOOLS: ToolId[] = ["chat", "code", "design", "images"];
const FILTERS: ("all" | ToolId)[] = ["all", "code", "design", "chat", "images"];
const LIVE_MODELS = MODELS.filter((m) => m.id !== "gpt" && m.id !== "grok");
const input = "w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] outline-none focus:border-faint";

async function api<T>(url: string, method = "GET", body?: object): Promise<T> {
  const r = await fetch(url, { method, cache: "no-store", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "Something went wrong. Try again");
  return data as T;
}

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Small preview of what's inside, drawn per tool. */
function Thumb({ p }: { p: Pick<Project, "tool"> }) {
  if (p.tool === "code")
    return (
      <div className="flex h-full flex-col gap-1.5 bg-[#101216] p-4 font-mono text-[11px] leading-relaxed text-[#9aa3b2]">
        <span>
          <span className="text-[#ff8a5c]">export</span> <span className="text-[#7cc4ff]">function</span> App() {"{"}
        </span>
        <span className="pl-4">
          return <span className="text-[#5ee0a0]">&lt;Home /&gt;</span>;
        </span>
        <span>{"}"}</span>
      </div>
    );
  if (p.tool === "design")
    return (
      <div className="grid h-full place-items-center bg-code bg-[radial-gradient(var(--line)_1px,transparent_1px)] bg-[length:14px_14px]">
        <div className="flex h-[118px] w-[66px] flex-col gap-1.5 rounded-[14px] border-4 border-[#0f1014] bg-[#fff7f2] p-2">
          <i className="h-1.5 w-8 rounded bg-[#1b1310]" />
          <i className="h-6 rounded-md bg-[#ff5a1f]" />
          <i className="h-1 rounded bg-[#eadfd8]" />
          <i className="mt-auto h-3 rounded bg-[#1b1310]" />
        </div>
      </div>
    );
  if (p.tool === "images")
    return (
      <div className="grid h-full grid-cols-2 gap-1 p-1">
        {["#e88a5c", "#7fa89c", "#e4b860", "#a08bd6"].map((c) => (
          <i key={c} className="rounded-md" style={{ background: c }} />
        ))}
      </div>
    );
  return (
    <div className="flex h-full flex-col gap-2 bg-code p-4">
      <i className="h-2 w-2/3 rounded bg-fg/70" />
      <i className="h-1.5 w-full rounded bg-line" />
      <i className="h-1.5 w-5/6 rounded bg-line" />
      <i className="h-1.5 w-4/6 rounded bg-line" />
      <i className="mt-auto h-6 w-1/2 rounded-lg bg-accent-soft" />
    </div>
  );
}

function ProjectCard({ p, onOpen }: { p: Project; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface text-left hover:border-faint hover:shadow-soft">
      <div className="h-[112px] overflow-hidden border-b border-line">
        <Thumb p={p} />
      </div>
      <div className="flex flex-col gap-1.5 p-3.5">
        <div className="flex items-center gap-2">
          <Icon name={p.tool} size={15} className="text-faint" />
          <b className="truncate font-semibold">{p.name}</b>
        </div>
        <p className="line-clamp-2 min-h-[2lh] text-[13px] text-muted">{p.about || "No description yet."}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-faint">
          <span className={chip}>{LABEL[p.tool]}</span>
          <span>{ago(p.updatedAt)}</span>
        </div>
      </div>
    </button>
  );
}

function Label({ text, children }: { text: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-medium">
      {text}
      {children}
    </label>
  );
}

/** What a preset dialog says and makes, e.g. "New slides" from the Design home. */
export type Preset = { tool: ToolId; kind?: DesignKind; title: string; description: string; namePlaceholder: string; briefPlaceholder: string };

export function NewProject({ open, onOpenChange, onCreated, preset }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (p: Project) => void; preset?: Preset }) {
  const [chosen, setTool] = useState<ToolId>("code");
  const tool = preset?.tool ?? chosen;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (form: FormData) => {
    setBusy(true);
    setError("");
    try {
      const { project } = await api<{ project: Project }>("/api/projects", "POST", {
        name: form.get("name"),
        about: form.get("about"),
        instructions: form.get("instructions"),
        tool,
        kind: preset?.kind,
      });
      onCreated(project);
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgb(8_9_12/0.45)]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[480px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-[20px] border border-line bg-surface p-5 text-fg shadow-soft">
          <header className="flex items-start gap-3">
            <div>
              <Dialog.Title className="font-display text-lg font-semibold tracking-[-0.02em]">{preset?.title ?? "New project"}</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-[13px] text-muted">{preset?.description ?? "Keep chats and instructions together for one thing you're building."}</Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close" className="ml-auto grid size-[34px] place-items-center rounded-full text-muted hover:bg-hover hover:text-fg">
              <Icon name="x" />
            </Dialog.Close>
          </header>
          <form action={submit} className="flex flex-col gap-3.5">
            <Label text="Name">
              <input name="name" required maxLength={80} className={input} placeholder={preset?.namePlaceholder ?? "My class revision app"} autoFocus />
            </Label>
            {!preset && (
              <div className="flex flex-col gap-1.5 text-[13px] font-medium">
                Mostly for
                <div className="inline-flex flex-wrap gap-0.5 self-start rounded-[10px] bg-hover p-[3px]" role="group" aria-label="Tool">
                  {TOOLS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={tool === t}
                      onClick={() => setTool(t)}
                      className={`rounded-lg px-3 py-1 font-normal ${tool === t ? "bg-surface font-medium text-fg shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted"}`}
                    >
                      {LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Label text="What it is (optional)">
              <input name="about" maxLength={300} className={input} placeholder="One line, so you can find it later" />
            </Label>
            <Label text={preset ? "Brief (optional)" : "Instructions (optional)"}>
              <textarea
                name="instructions"
                maxLength={4000}
                className={`${input} min-h-24 resize-y font-normal`}
                placeholder={preset?.briefPlaceholder ?? "Every chat in this project follows these. For example: for students on cheap Android phones; keep it fast and simple."}
              />
            </Label>
            {error && <p className="text-[13px] text-bad">{error}</p>}
            <div className="flex justify-end gap-2">
              <Dialog.Close className={btnGhost}>Cancel</Dialog.Close>
              <button type="submit" disabled={busy} className={`${btnDark} disabled:opacity-60`}>
                {busy ? "Creating…" : preset ? "Create" : "Create project"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ProjectDetail({ p, onBack, onChange, onDelete }: { p: Project; onBack: () => void; onChange: (p: Project) => void; onDelete: () => void }) {
  const { dispatch } = useWorkspace();
  const router = useRouter();
  const toast = (text: string) => dispatch({ type: "toast", text });

  const save = async (patch: Partial<Pick<Project, "name" | "about" | "instructions" | "modelId">>) => {
    if (Object.entries(patch).every(([k, v]) => p[k as keyof Project] === v)) return;
    try {
      const { project } = await api<{ project: Project }>(`/api/projects/${p.id}`, "PATCH", patch);
      onChange(project);
      toast("Saved");
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const remove = async () => {
    if (!window.confirm(`Delete "${p.name}"? You can ask us to restore it within 30 days.`)) return;
    try {
      await api(`/api/projects/${p.id}`, "DELETE");
      onDelete();
      toast("Project deleted");
    } catch (e) {
      toast((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack} className={btnGhost}>
          ← All projects
        </button>
        <span className={chip}>{LABEL[p.tool]}</span>
        <span className="text-xs text-faint">Updated {ago(p.updatedAt).replace(/^(Just|Yesterday)/, (w) => w.toLowerCase())}</span>
        <button
          type="button"
          onClick={() => {
            // A fresh conversation inside this project, so its instructions apply.
            dispatch({ type: "newChat", tool: p.tool, projectId: p.id });
            if (p.tool !== "images") dispatch({ type: "setModel", modelId: p.modelId });
            router.push("/app");
          }}
          className={`${btnDark} ml-auto`}
        >
          <Icon name="plus" size={15} /> Start a chat
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Details" note="Changes save when you click away.">
            <Label text="Name">
              <input key={`n${p.updatedAt}`} className={input} defaultValue={p.name} maxLength={80} onBlur={(e) => e.target.value.trim() && save({ name: e.target.value.trim() })} />
            </Label>
            <Label text="What it is">
              <input key={`a${p.updatedAt}`} className={input} defaultValue={p.about} maxLength={300} onBlur={(e) => save({ about: e.target.value.trim() })} />
            </Label>
          </Panel>
          <Panel title="Instructions" note="Every chat in this project follows these.">
            <textarea
              key={`i${p.updatedAt}`}
              className={`${input} min-h-36 resize-y`}
              defaultValue={p.instructions}
              maxLength={4000}
              placeholder="Who it's for, the style you want, things to always or never do."
              onBlur={(e) => save({ instructions: e.target.value.trim() })}
            />
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {p.tool !== "images" && (
            <Panel title="Model" note="What chats in this project start on.">
              <select className={input} value={p.modelId} onChange={(e) => save({ modelId: e.target.value })}>
                {LIVE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.credits} cr
                  </option>
                ))}
              </select>
            </Panel>
          )}
          <Panel title="Conversations" note="Chats you start here follow the instructions. They show in your sidebar under Recent.">
            <span className="text-[13px] text-muted">Press Start a chat to begin one.</span>
          </Panel>
          <Panel title="Files, people and coworkers">
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
              Shared files, teammates and coworkers for projects <span className={chip}>Soon</span>
            </div>
          </Panel>
          <button type="button" onClick={remove} className="self-start rounded-[10px] border border-bad/40 px-3.5 py-2 text-[13px] font-medium text-bad">
            Delete project
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProjectsView() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [open, setOpen] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api<{ projects: Project[] }>("/api/projects")
      .then((d) => {
        setProjects(d.projects);
        // /projects?open=12 opens that project straight away (used by the Design home).
        const id = Number(new URLSearchParams(window.location.search).get("open"));
        if (id) setOpen(id);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const project = projects?.find((p) => p.id === open);
  const shown = projects?.filter((p) => filter === "all" || p.tool === filter) ?? [];
  const replace = (next: Project) => setProjects((ps) => [next, ...(ps ?? []).filter((x) => x.id !== next.id)]);

  return (
    <PageFrame
      title={project ? project.name : "Projects"}
      subtitle={project ? project.about || undefined : "Keep chats and instructions together for each thing you're building."}
      actions={
        !project && (
          <button type="button" className={btnDark} onClick={() => setCreating(true)}>
            <Icon name="plus" size={15} /> New project
          </button>
        )
      }
    >
      <NewProject
        open={creating}
        onOpenChange={setCreating}
        onCreated={(p) => {
          replace(p);
          setOpen(p.id);
        }}
      />
      {project ? (
        <ProjectDetail
          p={project}
          onBack={() => setOpen(null)}
          onChange={replace}
          onDelete={() => {
            setProjects((ps) => (ps ?? []).filter((x) => x.id !== project.id));
            setOpen(null);
          }}
        />
      ) : error ? (
        <Panel>
          <p className="text-[13px] text-bad">Couldn&apos;t load your projects. {error}</p>
        </Panel>
      ) : projects === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading projects">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[214px] animate-pulse rounded-2xl border border-line bg-surface" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Panel>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-hover text-muted">
              <Icon name="plus" size={20} />
            </span>
            <b className="font-semibold">No projects yet</b>
            <p className="max-w-[360px] text-[13px] text-muted">A project keeps your instructions and chats for one thing together: an app, a class, a shop.</p>
            <button type="button" className={btnDark} onClick={() => setCreating(true)}>
              Create your first project
            </button>
          </div>
        </Panel>
      ) : (
        <>
          <div className="flex gap-0.5 self-start rounded-[10px] bg-hover p-[3px]" role="group" aria-label="Filter">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1 text-[13px] ${filter === f ? "bg-surface font-medium text-fg shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted"}`}
              >
                {f === "all" ? "All" : LABEL[f]}
              </button>
            ))}
          </div>
          {shown.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((p) => (
                <ProjectCard key={p.id} p={p} onOpen={() => setOpen(p.id)} />
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted">No {LABEL[filter as ToolId]} projects yet.</p>
          )}
        </>
      )}
    </PageFrame>
  );
}
