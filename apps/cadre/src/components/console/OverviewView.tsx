import Link from "next/link";
import { Icon } from "@/components/Icon";
import type { ActivityRow, AgentRow, ConnectionCard, Overview, SetupStep } from "@/lib/overview";

type Props = {
  overview: Overview;
  /** Server action that turns an agent on or off. Absent in previews, where toggles are read-only. */
  toggleAgent?: (formData: FormData) => Promise<void>;
  canEdit: boolean;
  activityHref: string;
};

export function OverviewView({ overview, toggleAgent, canEdit, activityHref }: Props) {
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-[680px] flex-col gap-1.5">
          <span className="eyebrow">Console · {overview.shop.name}</span>
          <h1 className="font-display text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[44px]">
            {headline(overview.steps)}
          </h1>
          <p className="text-muted">
            Day to day, everything happens on WhatsApp. Come back here to connect something new or change what your
            cadre may do.
          </p>
        </div>
      </header>

      <SetupChecklist steps={overview.steps} />
      <Connections cards={overview.connections} />

      <div className="flex flex-wrap items-start gap-6">
        <CadreList agents={overview.agents} toggleAgent={toggleAgent} canEdit={canEdit} />
        <Activity rows={overview.activity} href={activityHref} />
      </div>
    </>
  );
}

function headline(steps: SetupStep[]) {
  const left = steps.filter((s) => !s.done).length;
  if (left === 0)
    return (
      <>
        Your cadre is <span className="text-tangerine">running</span>.
      </>
    );
  return (
    <>
      Let&apos;s get your cadre <span className="text-tangerine">ready</span>.
    </>
  );
}

function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const done = steps.filter((s) => s.done).length;
  return (
    <section
      aria-labelledby="setup"
      className="flex flex-col gap-3.5 rounded-md border border-tangerine-line bg-tangerine-soft px-5 py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="setup" className="text-[17px] font-semibold">
          Setup: {done} of {steps.length} done
        </h2>
        <div
          className="h-1.5 flex-[0_1_260px] overflow-hidden rounded-pill bg-tangerine-line"
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={done}
        >
          <div className="h-full bg-tangerine" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-x-6 gap-y-2 text-sm">
        {steps.map((s) => (
          <li key={s.id} className="flex items-start gap-2.5">
            <span className={`mt-0.5 ${s.done ? "text-good" : "text-tangerine-text"}`}>
              <Icon name={s.done ? "check" : "circle"} label={s.done ? "Done" : "To do"} />
            </span>
            <span className="flex flex-col leading-snug">
              <span className="font-medium">{s.label}</span>
              {!s.done && !s.available && <span className="text-[13px] text-tangerine-text">Coming soon</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const STATE_LABEL: Record<ConnectionCard["state"], string> = {
  live: "Live",
  waiting: "Setting up",
  error: "Needs attention",
  off: "Not set up",
  soon: "Coming soon",
};

function Connections({ cards }: { cards: ConnectionCard[] }) {
  return (
    <section id="connections" aria-labelledby="connections-title" className="flex scroll-mt-6 flex-col gap-3">
      <h2 id="connections-title" className="font-display text-[22px] font-semibold leading-7 tracking-[-0.02em]">
        Connections
      </h2>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
        {cards.map((c) => (
          <li key={c.kind} className="flex flex-col gap-2 rounded-md border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{c.name}</span>
              <StateChip state={c.state} />
            </div>
            <span className="text-[13px] text-muted">{c.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StateChip({ state }: { state: ConnectionCard["state"] }) {
  if (state === "live")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-good">
        <span className="size-[7px] rounded-full bg-good" />
        {STATE_LABEL[state]}
      </span>
    );
  if (state === "waiting" || state === "error")
    return (
      <span className="rounded-pill border border-tangerine-line bg-tangerine-soft px-2 py-0.5 text-xs text-tangerine-text">
        {STATE_LABEL[state]}
      </span>
    );
  return <span className="rounded-pill bg-hover px-2 py-0.5 text-xs text-muted">{STATE_LABEL[state]}</span>;
}

function CadreList({
  agents,
  toggleAgent,
  canEdit,
}: {
  agents: AgentRow[];
  toggleAgent?: Props["toggleAgent"];
  canEdit: boolean;
}) {
  return (
    <section
      id="cadre"
      aria-labelledby="cadre-title"
      className="flex min-w-0 flex-[3_1_480px] scroll-mt-6 flex-col gap-3"
    >
      <h2 id="cadre-title" className="font-display text-[22px] font-semibold leading-7 tracking-[-0.02em]">
        Your cadre and what they send you
      </h2>
      <ul className="flex flex-col rounded-md border border-line bg-surface">
        {agents.map((a, i) => (
          <li
            key={a.id}
            className={`grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-3 ${
              i ? "border-t border-line" : ""
            }`}
          >
            <span className="num grid size-[34px] place-items-center rounded-[10px] bg-hover text-xs font-medium">
              {a.initials}
            </span>
            <span className="flex min-w-0 flex-col leading-snug">
              <span className="text-sm font-semibold">{a.name}</span>
              <span className="text-[13px] text-muted">{a.sends}</span>
            </span>
            {a.available ? (
              <AgentToggle agent={a} toggleAgent={toggleAgent} canEdit={canEdit} />
            ) : (
              <span className="text-xs text-muted">Coming soon</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function AgentToggle({
  agent,
  toggleAgent,
  canEdit,
}: {
  agent: AgentRow;
  toggleAgent?: Props["toggleAgent"];
  canEdit: boolean;
}) {
  const label = agent.enabled ? "On" : "Off";
  if (!toggleAgent || !canEdit) {
    return <span className={`text-xs font-semibold ${agent.enabled ? "text-good" : "text-muted"}`}>{label}</span>;
  }
  return (
    <form action={toggleAgent}>
      <input type="hidden" name="agent" value={agent.id} />
      <input type="hidden" name="enabled" value={String(!agent.enabled)} />
      <button
        type="submit"
        aria-label={`${agent.name} is ${label.toLowerCase()}. Turn ${agent.enabled ? "off" : "on"}`}
        className={`min-h-9 min-w-16 rounded-sm border px-3 text-[13px] font-semibold ${
          agent.enabled ? "border-tangerine-line bg-tangerine-soft text-tangerine-text" : "border-line text-muted"
        }`}
      >
        {label}
      </button>
    </form>
  );
}

function Activity({ rows, href }: { rows: ActivityRow[]; href: string }) {
  return (
    <section aria-labelledby="activity-title" className="flex min-w-0 flex-[2_1_320px] flex-col gap-3">
      <h2 id="activity-title" className="font-display text-[22px] font-semibold leading-7 tracking-[-0.02em]">
        Activity
      </h2>
      <ActivityList rows={rows} />
      <Link href={href} className="text-[13px] text-tangerine-text hover:underline">
        See the full activity log
      </Link>
    </section>
  );
}

export function ActivityList({ rows }: { rows: ActivityRow[] }) {
  if (!rows.length) {
    return <p className="rounded-md border border-line bg-surface p-4 text-sm text-muted">Nothing yet.</p>;
  }
  return (
    <ol className="rounded-md border border-line bg-surface">
      {rows.map((r, i) => (
        <li
          key={r.seq}
          className={`grid grid-cols-[72px_minmax(0,1fr)] gap-2.5 px-3.5 py-2.5 text-sm ${i ? "border-t border-line" : ""}`}
        >
          <time dateTime={r.at} className="num pt-0.5 text-xs text-muted">
            {formatWhen(r.at)}
          </time>
          <span>
            <span className="font-semibold">{r.actor}</span> <span className="text-muted">{r.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

const time = new Intl.DateTimeFormat("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Nairobi" });
const day = new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", timeZone: "Africa/Nairobi" });

function formatWhen(iso: string) {
  const d = new Date(iso);
  const sameDay = day.format(d) === day.format(new Date());
  return sameDay ? time.format(d) : day.format(d);
}
