"use client";

import { useState, type ReactNode } from "react";
import type { ToolId } from "@/lib/catalog";
import { useWorkspace } from "@/lib/workspace-store";
import { Icon, type IconName } from "../icon";
import { PageFrame, Panel, btnDark, btnGhost, chip } from "./page-frame";

type Project = {
  id: string;
  name: string;
  tool: ToolId;
  about: string;
  updated: string;
  model: string;
  source?: string;
  chats: number;
  files: number;
  credits: number;
  people: string[];
  coworkers: string[];
  instructions: string;
};

/* Sample projects for the design. Real ones come from the projects table in Step 2. */
const PROJECTS: Project[] = [
  {
    id: "salon",
    name: "Salon booking app",
    tool: "code",
    about: "Bookings, stylists and M-Pesa reminders for a salon in Nairobi.",
    updated: "2 hours ago",
    model: "Sonnet 5.5",
    source: "wandago/salon-booking",
    chats: 12,
    files: 18,
    credits: 214,
    people: ["L", "A"],
    coworkers: ["QA tester", "Launch writer"],
    instructions: "Next.js and Postgres. Keep it simple enough for a salon owner to use on a phone. Prices in KES. Never send an SMS without asking me first.",
  },
  {
    id: "habit",
    name: "Habit app onboarding",
    tool: "design",
    about: "Three onboarding screens: warm, confident, one action each.",
    updated: "Yesterday",
    model: "Sonnet 5.5",
    chats: 5,
    files: 4,
    credits: 38,
    people: ["L"],
    coworkers: [],
    instructions: "Warm colours, big type, one clear action per screen. Mobile first.",
  },
  {
    id: "farm",
    name: "Farm price tracker",
    tool: "code",
    about: "Daily market prices for maize and beans, by county.",
    updated: "3 days ago",
    model: "Haiku 5.5",
    source: "wandago/farm-prices",
    chats: 7,
    files: 11,
    credits: 64,
    people: ["L", "K", "M"],
    coworkers: ["Researcher"],
    instructions: "Data comes from public county reports. Show the source on every price.",
  },
  {
    id: "launch",
    name: "Launch posts for Wanlly",
    tool: "chat",
    about: "Build-in-public posts for X, TikTok and LinkedIn.",
    updated: "Last week",
    model: "Haiku 5.5",
    chats: 9,
    files: 3,
    credits: 22,
    people: ["L"],
    coworkers: ["Launch writer"],
    instructions: "Plain, human, no hype words. Short sentences. Always end with one question.",
  },
  {
    id: "mugs",
    name: "Mug product shots",
    tool: "images",
    about: "Photos for a ceramics shop's first online catalogue.",
    updated: "Last week",
    model: "Wanlly Image",
    chats: 3,
    files: 12,
    credits: 27,
    people: ["L", "W"],
    coworkers: [],
    instructions: "Natural morning light, wooden surfaces, no props with logos.",
  },
  {
    id: "study",
    name: "Study planner",
    tool: "design",
    about: "A revision timetable that adapts to exam dates.",
    updated: "2 weeks ago",
    model: "Haiku 5.5",
    chats: 4,
    files: 2,
    credits: 15,
    people: ["L"],
    coworkers: [],
    instructions: "For students on cheap Android phones. Fast, readable, works offline.",
  },
];

const LABEL: Record<ToolId, string> = { chat: "Chat", code: "Code", design: "Design", images: "Images" };
const FILTERS: ("all" | ToolId)[] = ["all", "code", "design", "chat", "images"];

/** Small preview of what's inside, drawn per tool. */
function Thumb({ p }: { p: Project }) {
  if (p.tool === "code")
    return (
      <div className="flex h-full flex-col gap-1.5 bg-[#101216] p-4 font-mono text-[11px] leading-relaxed text-[#9aa3b2]">
        <span>
          <span className="text-[#ff8a5c]">export</span> <span className="text-[#7cc4ff]">async function</span> book(slot) {"{"}
        </span>
        <span className="pl-4">const ok = await db.reserve(slot);</span>
        <span className="pl-4">
          if (ok) <span className="text-[#5ee0a0]">sms.remind</span>(slot.client);
        </span>
        <span>{"}"}</span>
        <span className="mt-auto flex items-center gap-1.5 text-[#5ee0a0]">
          <i className="size-1.5 rounded-full bg-current" /> 31 tests pass
        </span>
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
        {["#f2b48a,#e06a3b", "#bfd8d2,#5e8c7f", "#f4e3b5,#d99a2b", "#d7c9f0,#7d62c4"].map((g) => (
          <i key={g} className="rounded-md" style={{ background: `linear-gradient(140deg, ${g})` }} />
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

function Avatars({ people }: { people: string[] }) {
  return (
    <span className="flex -space-x-1.5">
      {people.map((p, i) => (
        <span
          key={i}
          className={`grid size-6 place-items-center rounded-full border-2 border-surface text-[10px] font-semibold ${i === 0 ? "bg-fg text-bg" : "text-white"}`}
          style={i === 0 ? undefined : { background: ["#2a78d6", "#11955a", "#b4235a"][(i - 1) % 3] }}
        >
          {p}
        </span>
      ))}
    </span>
  );
}

function ProjectCard({ p, onOpen }: { p: Project; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface text-left hover:border-faint hover:shadow-soft">
      <div className="h-[132px] overflow-hidden border-b border-line">
        <Thumb p={p} />
      </div>
      <div className="flex flex-col gap-1.5 p-3.5">
        <div className="flex items-center gap-2">
          <Icon name={p.tool} size={15} className="text-faint" />
          <b className="truncate font-semibold">{p.name}</b>
        </div>
        <p className="line-clamp-2 text-[13px] text-muted">{p.about}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-faint">
          <span className={chip}>{LABEL[p.tool]}</span>
          <span>{p.updated}</span>
          <span className="ml-auto">
            <Avatars people={p.people} />
          </span>
        </div>
      </div>
    </button>
  );
}

function Row({ icon, title, detail, right }: { icon: IconName; title: string; detail?: string; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-hover text-muted">
        <Icon name={icon} size={15} />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <span className="block truncate">{title}</span>
        {detail && <small className="block truncate text-xs text-muted">{detail}</small>}
      </div>
      {right}
    </div>
  );
}

function ProjectDetail({ p, onBack }: { p: Project; onBack: () => void }) {
  const { dispatch } = useWorkspace();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack} className={btnGhost}>
          ← All projects
        </button>
        <span className={chip}>{LABEL[p.tool]}</span>
        {p.source && (
          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted">
            <Icon name="github" size={14} /> {p.source}
          </span>
        )}
        <button
          type="button"
          onClick={() => dispatch({ type: "toast", text: `Opens a new ${LABEL[p.tool]} chat inside ${p.name}` })}
          className={`${btnDark} ml-auto`}
        >
          <Icon name="plus" size={15} /> New chat in project
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Instructions" note="Every chat and coworker in this project follows these.">
            <p className="rounded-xl border border-line bg-code px-3.5 py-3 text-sm">{p.instructions}</p>
          </Panel>
          <Panel title="Conversations" note={`${p.chats} in this project`}>
            <div className="flex flex-col">
              {["Add M-Pesa payment reminders to bookings", "Stylist schedule page", "Fix double bookings on Saturdays", "Explain the database to Amina"].slice(0, Math.min(4, p.chats)).map((t, i) => (
                <Row key={t} icon={p.tool} title={t} detail={["Sonnet 5.5 · 2 hours ago", "Haiku 5.5 · yesterday", "Opus 5.5 · 3 days ago", "Haiku 5.5 · last week"][i]} />
              ))}
            </div>
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Knowledge" note="Files every chat can read.">
            <div className="flex flex-col">
              {[
                ["Price list.pdf", "2 pages"],
                ["Brand colours.png", "Image"],
                ["Opening hours.md", "Notes"],
              ].map(([t, d]) => (
                <Row key={t} icon="clip" title={t} detail={d} />
              ))}
            </div>
            <button type="button" className={`${btnGhost} self-start`}>
              <Icon name="plus" size={15} /> Add files
            </button>
          </Panel>
          <Panel title="Coworkers" note="AI teammates assigned to this project.">
            <div className="flex flex-wrap gap-2">
              {p.coworkers.length ? p.coworkers.map((c) => <span key={c} className={chip}>{c}</span>) : <span className="text-sm text-muted">None yet</span>}
            </div>
          </Panel>
          <Panel title="People" note="Invite teammates to build with you. Each person uses their own credits.">
            <div className="flex items-center gap-3">
              <Avatars people={p.people} />
              <button type="button" className={`${btnGhost} ml-auto`}>
                <Icon name="users" size={15} /> Invite
              </button>
            </div>
          </Panel>
          <Panel title="This week">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted">Credits used</span>
              <b className="font-mono tabular-nums">{p.credits}</b>
            </div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted">Usual model</span>
              <b className="font-medium">{p.model}</b>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export function ProjectsView() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [open, setOpen] = useState<string | null>(null);
  const project = PROJECTS.find((p) => p.id === open);
  const shown = PROJECTS.filter((p) => filter === "all" || p.tool === filter);

  return (
    <PageFrame
      title={project ? project.name : "Projects"}
      subtitle={project ? project.about : "Keep chats, files, instructions and coworkers together for each thing you're building."}
      actions={
        !project && (
          <button type="button" className={btnDark}>
            <Icon name="plus" size={15} /> New project
          </button>
        )
      }
    >
      {project ? (
        <ProjectDetail p={project} onBack={() => setOpen(null)} />
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((p) => (
              <ProjectCard key={p.id} p={p} onOpen={() => setOpen(p.id)} />
            ))}
          </div>
        </>
      )}
    </PageFrame>
  );
}
