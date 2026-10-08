"use client";

import { useState } from "react";
import { useWorkspace } from "@/lib/workspace-store";
import { Icon, type IconName } from "../icon";
import { PageFrame, Panel, btnDark, btnGhost, chip } from "./page-frame";

type Coworker = {
  id: string;
  name: string;
  role: string;
  color: string;
  model: string;
  tools: string[];
  schedule: string;
  project: string;
  status: "working" | "waiting" | "idle";
  now: string;
  cap: number;
  used: number;
};

/* Sample coworkers for the design. They run on Claude Managed Agents in Step 6. */
const COWORKERS: Coworker[] = [
  {
    id: "qa",
    name: "Tess",
    role: "QA tester",
    color: "#2a78d6",
    model: "Haiku 5.5",
    tools: ["GitHub"],
    schedule: "After every pull request",
    project: "Salon booking app",
    status: "working",
    now: "Testing the Saturday booking flow on a small phone screen",
    cap: 30,
    used: 12,
  },
  {
    id: "writer",
    name: "Mo",
    role: "Launch writer",
    color: "#b4235a",
    model: "Haiku 5.5",
    tools: ["Google Docs"],
    schedule: "Weekdays at 8:00",
    project: "Launch posts for Wanlly",
    status: "waiting",
    now: "Drafted 3 posts for today. Waiting for you to pick one",
    cap: 10,
    used: 6,
  },
  {
    id: "desk",
    name: "Rafi",
    role: "Front desk",
    color: "#c2410c",
    model: "Haiku 5.5",
    tools: ["Twilio", "Database"],
    schedule: "Every evening at 18:00",
    project: "Salon booking app",
    status: "waiting",
    now: "Prepared tomorrow's 40 appointment reminders. Waiting for your OK to send",
    cap: 15,
    used: 3,
  },
  {
    id: "research",
    name: "Ada",
    role: "Researcher",
    color: "#11955a",
    model: "Sonnet 5.5",
    tools: ["Web search", "Google Sheets"],
    schedule: "Mondays",
    project: "Farm price tracker",
    status: "idle",
    now: "Next run Monday: collect this week's county maize prices",
    cap: 40,
    used: 0,
  },
];

const APPROVALS: { who: string; icon: IconName; title: string; detail: string; cost: string }[] = [
  {
    who: "Tess · QA tester",
    icon: "pr",
    title: "Open a pull request: fix double bookings on Saturdays",
    detail: "wandago/salon-booking · 2 files changed · tests pass",
    cost: "Spent 9 credits",
  },
  {
    who: "Mo · Launch writer",
    icon: "chat",
    title: "Pick today's post: 3 drafts ready",
    detail: "Launch posts for Wanlly · saved to your Google Doc",
    cost: "Spent 2 credits",
  },
  {
    who: "Rafi · Front desk",
    icon: "chat",
    title: "Send 40 SMS reminders through your Twilio account",
    detail: "Uses your Twilio key and your Twilio balance · about KES 32",
    cost: "Needs your OK",
  },
];

const TEMPLATES: { role: string; text: string; icon: IconName; model: string }[] = [
  { role: "Researcher", text: "Finds, checks and summarises sources into a sheet.", icon: "search", model: "Sonnet" },
  { role: "QA tester", text: "Clicks through your app after each change and files what breaks.", icon: "check", model: "Haiku" },
  { role: "Launch writer", text: "Drafts posts and emails in your voice, every morning.", icon: "chat", model: "Haiku" },
  { role: "Inbox helper", text: "Sorts messages and drafts replies for you to send.", icon: "clip", model: "Haiku" },
  { role: "Data cleaner", text: "Tidies spreadsheets and flags anything odd.", icon: "images", model: "Haiku" },
  { role: "Code reviewer", text: "Reads every pull request and leaves clear comments.", icon: "code", model: "Sonnet" },
];

const STATUS = {
  working: ["bg-accent-soft text-accent", "Working"],
  waiting: ["bg-[#fff4d6] text-[#8a5a00] dark:bg-[#2a2210] dark:text-[#f0c35a]", "Needs you"],
  idle: ["bg-hover text-muted", "Scheduled"],
} as const;

function Avatar({ c, size = 40 }: { c: Coworker; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-2xl font-display font-semibold text-white" style={{ background: c.color, width: size, height: size, fontSize: size * 0.42 }}>
      {c.name[0]}
    </span>
  );
}

function CoworkerCard({ c }: { c: Coworker }) {
  const [on, setOn] = useState(true);
  const [cls, label] = STATUS[c.status];
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <Avatar c={c} />
        <div className="min-w-0 flex-1">
          <b className="block font-semibold">
            {c.name} <span className="font-normal text-muted">· {c.role}</span>
          </b>
          <small className="text-xs text-muted">{c.project}</small>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>{label}</span>
      </div>
      <p className="flex items-start gap-2 rounded-xl bg-code px-3 py-2.5 text-[13px]">
        {c.status === "working" && <span className="mt-1 size-3 shrink-0 animate-spin rounded-full border-2 border-accent-line border-t-accent" />}
        {c.now}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <span className={chip}>{c.model}</span>
        {c.tools.map((t) => (
          <span key={t} className={chip}>
            {t}
          </span>
        ))}
        <span className={`${chip} inline-flex items-center gap-1`}>
          <Icon name="clock" size={12} /> {c.schedule}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs text-muted">
          <span>Daily credit cap</span>
          <span className="font-mono tabular-nums">
            {c.used} / {c.cap}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-hover">
          <i className="block h-full rounded-full bg-accent" style={{ width: `${(c.used / c.cap) * 100}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-line pt-3">
        <button type="button" className={btnGhost}>
          Open
        </button>
        <label className="ml-auto flex items-center gap-2 text-[13px] text-muted">
          {on ? "On" : "Paused"}
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={`${c.name} on or paused`}
            onClick={() => setOn(!on)}
            className={`relative h-[22px] w-[38px] rounded-full transition-colors ${on ? "bg-accent" : "bg-line"}`}
          >
            <i className={`absolute top-[3px] size-4 rounded-full bg-white shadow transition-[left] ${on ? "left-[19px]" : "left-[3px]"}`} />
          </button>
        </label>
      </div>
    </article>
  );
}

export function CoworkersView() {
  const { dispatch } = useWorkspace();
  const [done, setDone] = useState<Record<number, "ok" | "no">>({});

  return (
    <PageFrame
      title="Coworkers"
      subtitle="AI teammates that work in the background on a schedule, inside your projects, within a daily credit cap you set."
      actions={
        <button type="button" className={btnDark}>
          <Icon name="plus" size={15} /> New coworker
        </button>
      }
    >
      <Panel title="Needs you" note="Coworkers ask before anything leaves Wanlly: code, messages, money.">
        <div className="flex flex-col">
          {APPROVALS.map((a, i) => (
            <div key={a.title} className="flex flex-wrap items-center gap-3 border-t border-line py-3 first:border-t-0 first:pt-0">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-hover text-muted">
                <Icon name={a.icon} size={16} />
              </span>
              <div className="min-w-0 flex-1 basis-[260px]">
                <small className="text-xs text-faint">{a.who}</small>
                <b className="block text-sm font-semibold">{a.title}</b>
                <small className="block text-xs text-muted">
                  {a.detail} · {a.cost}
                </small>
              </div>
              {done[i] ? (
                <span className={`text-sm font-medium ${done[i] === "ok" ? "text-good" : "text-muted"}`}>{done[i] === "ok" ? "Approved" : "Declined"}</span>
              ) : (
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDone((d) => ({ ...d, [i]: "ok" }));
                      dispatch({ type: "toast", text: "Approved. It runs now" });
                    }}
                    className={btnDark}
                  >
                    Approve
                  </button>
                  <button type="button" onClick={() => setDone((d) => ({ ...d, [i]: "no" }))} className={btnGhost}>
                    Decline
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        {COWORKERS.map((c) => (
          <CoworkerCard key={c.id} c={c} />
        ))}
      </div>

      <Panel title="Hire a coworker" note="Start from a role. You can change its instructions, tools, schedule and cap.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t) => (
            <button key={t.role} type="button" className="flex items-start gap-3 rounded-xl border border-line p-3 text-left hover:border-faint">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-hover text-muted">
                <Icon name={t.icon} size={16} />
              </span>
              <span className="min-w-0">
                <b className="block text-sm font-semibold">{t.role}</b>
                <small className="block text-xs text-muted">{t.text}</small>
                <small className="mt-1 block font-mono text-[11px] text-faint">Runs on {t.model}</small>
              </span>
            </button>
          ))}
        </div>
      </Panel>

      <p className="flex items-center gap-2 text-xs text-faint">
        <Icon name="lock" size={14} /> Coworkers unlock once your account is 7 days old. They spend your credits, never more than each one&apos;s daily cap.
      </p>
    </PageFrame>
  );
}
