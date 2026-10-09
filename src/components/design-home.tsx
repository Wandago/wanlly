"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useWorkspace } from "@/lib/workspace-store";
import { Icon, type IconName } from "./icon";
import { NewProject, type DesignKind, type Preset, type Project } from "./pages/projects-view";
import { STYLES } from "@/lib/design-styles";
import { StylePreview, StyleThumb } from "./style-picker";

/*
 * The Design tool's home: start something new from one of four kinds, then find your design
 * files by day. Files are projects with tool "design"; opening one goes to its project page.
 */

const KINDS: Record<DesignKind, { label: string; plural: string; icon: IconName; tint: string; isNew?: boolean; preset: Omit<Preset, "tool" | "kind"> }> = {
  slides: {
    label: "Slides",
    plural: "Slides",
    icon: "slides",
    tint: "#c8892e",
    isNew: true,
    preset: { title: "New slides", description: "A deck for a class, a pitch or a talk.", namePlaceholder: "Final year project pitch", briefPlaceholder: "Who it's for, how many slides, the story you want to tell." },
  },
  design: {
    label: "Design",
    plural: "Designs",
    icon: "design",
    tint: "#7b6fd6",
    isNew: true,
    preset: { title: "New design", description: "Screens for an app or a website.", namePlaceholder: "Study planner app", briefPlaceholder: "What the screens are for, the feel you want, phone or desktop." },
  },
  codebase: {
    label: "Design in codebase",
    plural: "Codebase designs",
    icon: "code",
    tint: "#3f8f8a",
    preset: { title: "New design in a codebase", description: "Design straight into an existing app's code.", namePlaceholder: "Salon booking: new checkout", briefPlaceholder: "Which app, which screens, and what should change." },
  },
  system: {
    label: "Design System",
    plural: "Design systems",
    icon: "grid",
    tint: "#5568d8",
    preset: { title: "New design system", description: "Colours, type and components to reuse everywhere.", namePlaceholder: "My brand", briefPlaceholder: "Your brand's colours and fonts, and the components you need." },
  },
};
const ORDER: DesignKind[] = ["slides", "design", "codebase", "system"];

/** A soft tint of a colour over the page surface, so art works in light and dark. */
const tint = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, var(--surface))`;

function Art({ kind }: { kind: DesignKind }) {
  const c = KINDS[kind].tint;
  const box = "grid h-full place-items-center rounded-xl";
  if (kind === "slides")
    return (
      <div className={box} style={{ background: tint(c, 22) }}>
        <div className="flex h-[62%] w-[72%] items-center gap-3 rounded-lg border p-3" style={{ background: tint(c, 40), borderColor: tint(c, 55) }}>
          <div className="flex flex-1 flex-col gap-2">
            <i className="h-2.5 w-[80%] rounded-full" style={{ background: c }} />
            <i className="h-1.5 w-[65%] rounded-full" style={{ background: tint(c, 70) }} />
            <i className="h-1.5 w-[50%] rounded-full" style={{ background: tint(c, 70) }} />
          </div>
          <i className="size-8 rounded-md" style={{ background: tint(c, 80) }} />
        </div>
      </div>
    );
  if (kind === "design")
    return (
      <div className={box} style={{ background: tint(c, 18) }}>
        <div className="flex h-[82%] w-[30%] flex-col gap-1.5 rounded-xl border p-2" style={{ background: tint(c, 32), borderColor: tint(c, 50) }}>
          <i className="mx-auto h-1 w-4 rounded-full" style={{ background: tint(c, 60) }} />
          {[0, 1].map((i) => (
            <span key={i} className="flex items-center gap-1">
              <i className="size-2 rounded-full" style={{ background: c }} />
              <i className="h-1 flex-1 rounded-full" style={{ background: tint(c, 60) }} />
            </span>
          ))}
          <i className="mt-auto h-2.5 rounded-md" style={{ background: tint(c, 70) }} />
        </div>
      </div>
    );
  if (kind === "codebase")
    return (
      <div className="relative h-full rounded-xl bg-[radial-gradient(var(--line)_1px,transparent_1px)] bg-[length:10px_10px]" style={{ backgroundColor: tint(c, 14) }}>
        <i className="absolute top-[18%] right-[16%] h-[42%] w-[34%] rounded-md border" style={{ background: tint(c, 40), borderColor: tint(c, 55) }} />
        <span className="absolute bottom-[16%] left-[16%] flex h-[42%] w-[46%] flex-col justify-center gap-1.5 rounded-md bg-[#0d0f12] px-2.5 font-mono text-[13px] text-white">
          &gt;_
          <i className="h-0.5 w-1/2 rounded-full bg-white/40" />
        </span>
      </div>
    );
  return (
    <div className={box} style={{ background: tint(c, 16) }}>
      <div className="flex h-[66%] w-[74%] flex-col justify-center gap-2.5 rounded-lg border p-3" style={{ background: tint(c, 30), borderColor: tint(c, 45) }}>
        <span className="flex gap-1.5">
          {[c, tint(c, 70), "#f2d5c8", "#d9eadf"].map((s) => (
            <i key={s} className="size-4 rounded" style={{ background: s }} />
          ))}
        </span>
        <i className="h-1.5 w-[60%] rounded-full" style={{ background: tint(c, 60) }} />
        <i className="h-1.5 w-[80%] rounded-full" style={{ background: tint(c, 50) }} />
      </div>
    </div>
  );
}

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dayGroup(iso: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const t = new Date(iso).getTime();
  if (t >= start.getTime()) return "Today";
  if (t >= start.getTime() - 864e5) return "Yesterday";
  if (t >= start.getTime() - 7 * 864e5) return "Previous 7 days";
  return "Older";
}

const iconBtn = "grid size-9 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg data-[state=open]:bg-hover aria-pressed:bg-hover aria-pressed:text-fg";
const menuItem = "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] outline-none data-[highlighted]:bg-hover";
const menuBox = "z-40 min-w-[180px] rounded-xl border border-line bg-surface p-1 text-fg shadow-soft";

function Dropdown({ trigger, label, children }: { trigger: ReactNode; label: string; children: ReactNode }) {
  return (
    <Menu.Root>
      <Menu.Trigger aria-label={label} asChild>
        {trigger}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={6} className={menuBox}>
          {children}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

async function api<T>(url: string, method = "GET", body?: object): Promise<T> {
  const r = await fetch(url, { method, cache: "no-store", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "Something went wrong. Try again");
  return data as T;
}

export function DesignHome() {
  const { dispatch } = useWorkspace();
  const router = useRouter();
  const [items, setItems] = useState<Project[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"all" | "yours" | "shared">("all");
  const [type, setType] = useState<"all" | DesignKind>("all");
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const [view, setView] = useState<"list" | "grid">("list");
  const [search, setSearch] = useState<string | null>(null);
  const [creating, setCreating] = useState<DesignKind | null>(null);

  useEffect(() => {
    api<{ projects: Project[] }>("/api/projects?tool=design")
      .then((d) => setItems(d.projects))
      .catch((e: Error) => setError(e.message));
  }, []);

  const open = (p: Project) => router.push(`/design/${p.id}`);
  /** A style picked from "Start from a look", applied to the design that's created next. */
  const [look, setLook] = useState<string | null>(null);
  /** The style shown large, before the person decides to use it. */
  const [preview, setPreview] = useState<string | null>(null);
  const rename = async (p: Project) => {
    const name = window.prompt("Rename", p.name)?.trim();
    if (!name || name === p.name) return;
    try {
      const { project } = await api<{ project: Project }>(`/api/projects/${p.id}`, "PATCH", { name });
      setItems((xs) => (xs ?? []).map((x) => (x.id === p.id ? project : x)));
    } catch (e) {
      dispatch({ type: "toast", text: (e as Error).message });
    }
  };
  const remove = async (p: Project) => {
    if (!window.confirm(`Delete "${p.name}"? You can ask us to restore it within 30 days.`)) return;
    try {
      await api(`/api/projects/${p.id}`, "DELETE");
      setItems((xs) => (xs ?? []).filter((x) => x.id !== p.id));
    } catch (e) {
      dispatch({ type: "toast", text: (e as Error).message });
    }
  };

  const shown = useMemo(() => {
    if (tab === "shared") return [];
    const q = search?.trim().toLowerCase() ?? "";
    const list = (items ?? []).filter((p) => (type === "all" || (p.kind ?? "design") === type) && (!q || p.name.toLowerCase().includes(q) || p.about.toLowerCase().includes(q)));
    return sort === "name" ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : list;
  }, [items, tab, type, sort, search]);

  const groups = useMemo(() => {
    if (sort === "name") return [["", shown]] as [string, Project[]][];
    const map = new Map<string, Project[]>();
    for (const p of shown) {
      const g = dayGroup(p.updatedAt);
      map.set(g, [...(map.get(g) ?? []), p]);
    }
    return [...map.entries()];
  }, [shown, sort]);

  const itemMenu = (p: Project) => (
    <Dropdown
      label={`More for ${p.name}`}
      trigger={
        <button type="button" className={iconBtn} onClick={(e) => e.stopPropagation()}>
          <Icon name="more" size={18} />
        </button>
      }
    >
      <Menu.Item className={menuItem} onSelect={() => open(p)}>
        Open
      </Menu.Item>
      <Menu.Item className={menuItem} onSelect={() => rename(p)}>
        Rename
      </Menu.Item>
      <Menu.Item className={`${menuItem} text-bad`} onSelect={() => remove(p)}>
        Delete
      </Menu.Item>
    </Dropdown>
  );

  const meta = (p: Project) => (
    <span className="flex items-center gap-1.5 text-[13px] whitespace-nowrap text-muted">
      <Icon name="lock" size={14} className="text-faint" />
      <span className="text-faint">·</span> Edited {ago(p.updatedAt)}
    </span>
  );

  return (
    <main className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-9">
        <header className="flex items-center gap-2">
          <button type="button" aria-label="Open sidebar" onClick={() => dispatch({ type: "setSidebar", open: true })} className="grid rounded-[10px] p-2 hover:bg-hover md:hidden">
            <Icon name="menu" />
          </button>
          <h1 className="font-display text-[32px] leading-none font-semibold tracking-[-0.03em]">Design</h1>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1" role="tablist" aria-label="Show">
            {(
              [
                ["all", "All"],
                ["yours", "Yours"],
                ["shared", "Shared with you"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`rounded-lg px-3 py-1.5 text-[15px] ${tab === k ? "bg-hover font-medium text-fg" : "text-muted hover:text-fg"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1">
            {search !== null && (
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setSearch(null)}
                placeholder="Search designs"
                aria-label="Search designs"
                className="w-40 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-faint sm:w-56"
              />
            )}
            <button type="button" aria-label="Search" aria-pressed={search !== null} onClick={() => setSearch(search === null ? "" : null)} className={iconBtn}>
              <Icon name="search" size={19} />
            </button>
            <button type="button" aria-label={view === "list" ? "Show as grid" : "Show as list"} onClick={() => setView(view === "list" ? "grid" : "list")} className={iconBtn}>
              <Icon name={view === "list" ? "grid" : "list"} size={19} />
            </button>
            <Dropdown
              label="Sort"
              trigger={
                <button type="button" className={iconBtn}>
                  <Icon name="sliders" size={19} />
                </button>
              }
            >
              <Menu.RadioGroup value={sort} onValueChange={(v) => setSort(v as "recent" | "name")}>
                <Menu.Label className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium tracking-[0.08em] text-faint uppercase">Sort by</Menu.Label>
                {(
                  [
                    ["recent", "Last edited"],
                    ["name", "Name"],
                  ] as const
                ).map(([v, l]) => (
                  <Menu.RadioItem key={v} value={v} className={menuItem}>
                    <span className="flex-1">{l}</span>
                    <Menu.ItemIndicator>
                      <Icon name="check" size={14} />
                    </Menu.ItemIndicator>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Dropdown>
            <Dropdown
              label="Type"
              trigger={
                <button type="button" className="ml-1 flex items-center gap-1.5 rounded-lg bg-hover px-3 py-1.5 text-[14px] font-medium hover:text-fg data-[state=open]:ring-1 data-[state=open]:ring-line">
                  {type === "all" ? "All types" : KINDS[type].plural}
                  <Icon name="down" size={15} className="text-faint" />
                </button>
              }
            >
              <Menu.RadioGroup value={type} onValueChange={(v) => setType(v as "all" | DesignKind)}>
                {(["all", ...ORDER] as const).map((k) => (
                  <Menu.RadioItem key={k} value={k} className={menuItem}>
                    <span className="flex-1">{k === "all" ? "All types" : KINDS[k].plural}</span>
                    <Menu.ItemIndicator>
                      <Icon name="check" size={14} />
                    </Menu.ItemIndicator>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Dropdown>
          </div>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] text-muted">Make something new</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
            {ORDER.map((k) => (
              <button key={k} type="button" onClick={() => setCreating(k)} className="group flex flex-col gap-2.5 text-left">
                <span className="block h-[140px] rounded-2xl border border-line bg-surface p-2 transition-colors group-hover:border-faint">
                  <Art kind={k} />
                </span>
                <span className="flex items-center gap-2 text-[15px] font-medium">
                  {KINDS[k].label}
                  {KINDS[k].isNew && <span className="rounded-md bg-series-1/15 px-1.5 py-0.5 text-xs font-medium text-series-1">New</span>}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-[15px] text-muted">Start from a look</h2>
            <small className="text-[12px] text-faint">Have a site you love? Attach a screenshot in the editor and say &ldquo;in this style&rdquo;.</small>
          </div>
          <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-x-4 sm:gap-y-5 sm:overflow-visible sm:px-0 lg:grid-cols-5">
            {STYLES.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setPreview(st.id)}
                className="group flex w-[168px] shrink-0 snap-start flex-col gap-2 text-left sm:w-auto"
              >
                <span className="block aspect-[4/3] overflow-hidden rounded-xl border border-line transition-transform group-hover:-translate-y-0.5 group-hover:border-faint">
                  <StyleThumb id={st.id} />
                </span>
                <span>
                  <b className="block text-[14px] font-medium">{st.name}</b>
                  <small className="block text-[12px] text-muted">{st.blurb}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        {error ? (
          <p className="rounded-xl border border-line bg-surface px-4 py-3 text-[13px] text-bad">Couldn&apos;t load your designs. {error}</p>
        ) : items === null ? (
          <div className="flex flex-col gap-2" aria-label="Loading">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-hover/60" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-[13px] text-muted">
            {tab === "shared"
              ? "Nothing shared with you yet. Sharing designs is coming soon."
              : items.length === 0
                ? "Your designs will show here. Start one above."
                : "Nothing matches. Try another search or type."}
          </p>
        ) : (
          groups.map(([label, list]) => (
            <section key={label || "all"} className="flex flex-col gap-1">
              {label && <h2 className="mb-1 text-[15px] text-muted">{label}</h2>}
              {view === "list" ? (
                <ul className="flex flex-col">
                  {list.map((p) => {
                    const k = KINDS[p.kind ?? "design"];
                    return (
                      <li key={p.id} className="group -mx-2 flex items-center gap-4 rounded-xl px-2 py-2 hover:bg-hover/60">
                        <button type="button" onClick={() => open(p)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
                          <span className="grid size-12 shrink-0 place-items-center rounded-xl" style={{ background: tint(k.tint, 22), color: k.tint }}>
                            <Icon name={k.icon} size={20} />
                          </span>
                          <span className="min-w-0">
                            <b className="block truncate text-[15px] font-medium">{p.name}</b>
                            {p.about && <small className="block truncate text-[13px] text-muted">{p.about}</small>}
                          </span>
                          <span className="ml-auto max-sm:hidden">{meta(p)}</span>
                        </button>
                        {itemMenu(p)}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {list.map((p) => (
                    <div key={p.id} className="flex flex-col gap-2">
                      <button type="button" onClick={() => open(p)} className="block h-[130px] rounded-2xl border border-line bg-surface p-2 hover:border-faint" aria-label={`Open ${p.name}`}>
                        <Art kind={p.kind ?? "design"} />
                      </button>
                      <div className="flex items-start gap-1">
                        <div className="min-w-0 flex-1">
                          <b className="block truncate text-[14px] font-medium">{p.name}</b>
                          {meta(p)}
                        </div>
                        {itemMenu(p)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </div>

      <StylePreview
        id={preview}
        onIdChange={setPreview}
        onUse={(id) => {
          setPreview(null);
          setLook(id);
          setCreating("design");
        }}
      />

      <NewProject
        key={creating ?? "none"}
        open={creating !== null}
        onOpenChange={(o) => {
          if (o) return;
          setCreating(null);
          setLook(null);
        }}
        preset={
          creating
            ? {
                tool: "design",
                kind: creating,
                ...KINDS[creating].preset,
                ...(look ? { title: `New design · ${STYLES.find((x) => x.id === look)?.name ?? ""} style` } : {}),
              }
            : undefined
        }
        onCreated={(p) => {
          // The editor reads its starting style from here (see design-editor.tsx).
          if (look)
            try {
              localStorage.setItem(`wanlly-ds-${p.id}`, `style:${look}`);
            } catch {}
          open(p);
        }}
      />
    </main>
  );
}
