"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  AD_FORMATS,
  COUNTRIES,
  FLAGGED,
  FUNNEL,
  MODELS_USAGE,
  NETWORKS,
  POOL,
  QUEUE,
  SOURCES,
  TOP_CLICKED,
  sampleDays,
  type Applicant,
} from "@/lib/admin-sample";

const money = (v: number) => (v >= 1000 ? `$${Math.round(v).toLocaleString("en-US")}` : v >= 10 ? `$${v.toFixed(0)}` : `$${v.toFixed(2)}`);
const num = (v: number) => v.toLocaleString("en-US");
const pct = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;

function Card({ title, note, children, className = "" }: { title: string; note?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 ${className}`}>
      <header className="flex flex-col gap-0.5">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {note && <p className="text-[13px] text-muted">{note}</p>}
      </header>
      {children}
    </section>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "good" | "bad" }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
      <span className="text-[11px] font-medium tracking-[0.08em] text-faint uppercase">{label}</span>
      <span className="font-display text-[28px] leading-none font-semibold tracking-[-0.02em] tabular-nums">{value}</span>
      <span className={`text-[13px] ${tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-muted"}`}>{sub}</span>
    </div>
  );
}

/** Inline bar for table cells. Single series, so no legend; the column header names it. */
function Bar({ value, max, color = "bg-series-1" }: { value: number; max: number; color?: string }) {
  return (
    <span className="block h-2 min-w-[2px] rounded-r-[3px]" style={{ width: `${Math.max(2, (value / max) * 100)}%` }}>
      <span className={`block h-full rounded-r-[3px] ${color}`} />
    </span>
  );
}

function Table({ head, rows, align }: { head: string[]; rows: ReactNode[][]; align?: ("l" | "r")[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`border-b border-line px-2 py-2 font-medium whitespace-nowrap text-muted ${align?.[i] === "r" ? "text-right" : "text-left"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-hover/60">
              {r.map((c, j) => (
                <td key={j} className={`border-b border-line px-2 py-2 align-middle ${align?.[j] === "r" ? "text-right font-mono tabular-nums whitespace-nowrap" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Revenue vs AI cost per day: two lines, one axis, crosshair tooltip on hover. */
function RevenueChart({ days }: { days: ReturnType<typeof sampleDays> }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 220, P = { l: 48, r: 12, t: 12, b: 26 };
  const max = Math.max(...days.map((d) => Math.max(d.revenue, d.aiCost))) * 1.1;
  const x = (i: number) => P.l + (i / Math.max(1, days.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);
  const line = (k: "revenue" | "aiCost") => days.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join("");
  const ticks = [0, max / 2, max];
  const h = hover !== null ? days[hover] : null;
  return (
    <div className="relative">
      <div className="mb-2 flex gap-4 text-[13px] text-muted">
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-series-1" />Ad revenue</span>
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] bg-series-2" />AI cost</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Ad revenue and AI cost per day"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - P.l) / (W - P.l - P.r)) * (days.length - 1));
          setHover(Math.min(days.length - 1, Math.max(0, i)));
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--line)" />
            <text x={P.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--faint)" fontFamily="var(--font-mono)">
              {money(t)}
            </text>
          </g>
        ))}
        {[0, Math.floor((days.length - 1) / 2), days.length - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"} fontSize="11" fill="var(--faint)" fontFamily="var(--font-mono)">
            {days[i].date}
          </text>
        ))}
        <path d={line("aiCost")} fill="none" stroke="var(--series-2)" strokeWidth="2" />
        <path d={line("revenue")} fill="none" stroke="var(--series-1)" strokeWidth="2" />
        {h && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="var(--faint)" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(h.revenue)} r="4" fill="var(--series-1)" stroke="var(--surface)" strokeWidth="2" />
            <circle cx={x(hover)} cy={y(h.aiCost)} r="4" fill="var(--series-2)" stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-8 rounded-lg bg-fg px-2.5 py-1.5 text-xs text-bg shadow-soft"
          style={{ left: `min(calc(${(x(hover) / W) * 100}% + 10px), calc(100% - 170px))` }}
        >
          <b>{h.date}</b> · {num(h.activeUsers)} active
          <br />
          Revenue {money(h.revenue)} · AI {money(h.aiCost)} · Margin {money(h.revenue - h.aiCost)}
        </div>
      )}
    </div>
  );
}

function RiskChip({ risk }: { risk: Applicant["risk"] }) {
  const map = { low: ["text-good bg-good/12", "Low risk"], medium: ["text-muted bg-hover", "Check"], high: ["text-bad bg-bad/12", "High risk"] } as const;
  const [cls, label] = map[risk];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>{risk === "high" ? "⚠ " : ""}{label}</span>;
}

export function AdminDashboard() {
  const [range, setRange] = useState<7 | 30>(30);
  const [decisions, setDecisions] = useState<Record<string, "approved" | "rejected">>({});
  const days = useMemo(() => sampleDays(range), [range]);
  const rev = days.reduce((a, d) => a + d.revenue, 0);
  const cost = days.reduce((a, d) => a + d.aiCost, 0);
  const formats = AD_FORMATS.map((f) => ({ ...f, revenue: (f.impressions / 1000) * f.ecpm, ctr: f.clicks / f.impressions }));
  const maxFormatRev = Math.max(...formats.map((f) => f.revenue));
  const nets = NETWORKS.map((n) => ({ ...n, bidRate: n.bids / n.requests, winRate: n.wins / n.bids, revenue: (n.wins / 1000) * n.avgBid }));
  const maxNetRev = Math.max(...nets.map((n) => n.revenue));
  const maxSource = Math.max(...SOURCES.map((s) => s.applications));
  const maxCountry = Math.max(...COUNTRIES.map((c) => c.users));
  const pending = QUEUE.filter((a) => !decisions[a.id]).length;

  return (
    <div className="min-h-full bg-bg px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em]">Admin</h1>
          <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-muted">Sample data · design preview</span>
          <div className="ml-auto flex gap-0.5 rounded-[10px] bg-hover p-[3px]" role="group" aria-label="Date range">
            {([7, 30] as const).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={range === r}
                onClick={() => setRange(r)}
                className={`rounded-lg px-3 py-1 text-[13px] ${range === r ? "bg-surface font-medium text-fg shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted"}`}
              >
                Last {r} days
              </button>
            ))}
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi label="Ad revenue" value={money(rev)} sub={`${money(rev / range)} a day`} />
          <Kpi label="AI cost" value={money(cost)} sub={`${pct(cost / rev)} of revenue`} />
          <Kpi label="Margin" value={money(rev - cost)} sub={rev > cost ? "Ads cover AI" : "AI costs more than ads"} tone={rev > cost ? "good" : "bad"} />
          <Kpi label="Active today" value={num(days[days.length - 1].activeUsers)} sub={`${num(days.reduce((a, d) => a + d.signups, 0))} new in range`} />
          <Kpi label="Beta applications" value={num(FUNNEL[1].n)} sub={`${pct(FUNNEL[1].n / FUNNEL[0].n)} of visitors apply`} />
          <Kpi label="Waiting for approval" value={num(pending)} sub="in the queue below" />
        </div>

        <Card title="Ad revenue vs AI cost" note="Per day. The gap between the lines is what keeps Wanlly running.">
          <RevenueChart days={days} />
        </Card>

        <Card title="First-video bonus" note="The bonus for each person's first video of the day. Paid only from revenue already received.">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="grid grid-cols-2 content-start gap-x-4 gap-y-3">
              {[
                ["Pool balance", money(POOL.balance), `about ${Math.floor(POOL.balance / POOL.spentToday)} days at today's rate`],
                ["Spent today", money(POOL.spentToday), `${num(POOL.reachedToday)} people topped up`],
                ["Today's floor", `$${POOL.floorUsd.toFixed(3)}`, POOL.floorLabel],
                ["Reached", `${POOL.countries} countries`, POOL.floorChange],
              ].map(([l, v, s]) => (
                <div key={l} className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[11px] font-medium tracking-[0.08em] text-faint uppercase">{l}</span>
                  <span className="font-display text-[22px] leading-tight font-semibold tabular-nums">{v}</span>
                  <span className="text-xs text-muted">{s}</span>
                </div>
              ))}
            </div>
            <Table
              head={["Paid in this month", "", "Amount"]}
              align={["l", "l", "r"]}
              rows={POOL.sources.map((s) => [s.name, <span key="n" className="text-muted">{s.note}</span>, money(s.amount)])}
            />
            <Table
              head={["Where it went", "On the floor", "Spent", ""]}
              align={["l", "r", "r", "l"]}
              rows={POOL.regions.map((r) => [r.name, pct(r.onFloor), money(r.spent), <div key="b" className="w-16"><Bar value={r.spent} max={POOL.regions[0].spent} /></div>])}
            />
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Ads by format" note="Which placements earn, and how often people click them.">
            <Table
              head={["Format", "Views", "Fill", "CTR", "eCPM", "Revenue", ""]}
              align={["l", "r", "r", "r", "r", "r", "l"]}
              rows={formats.map((f) => [f.name, num(f.impressions), pct(f.fill), pct(f.ctr), `$${f.ecpm.toFixed(2)}`, money(f.revenue), <div key="b" className="w-20"><Bar value={f.revenue} max={maxFormatRev} /></div>])}
            />
          </Card>
          <Card title="Ad networks and bidding" note="Every request, how many networks bid, who won and for how much.">
            <Table
              head={["Network", "Requests", "Bid rate", "Win rate", "Avg bid", "Timeouts", "Revenue", ""]}
              align={["l", "r", "r", "r", "r", "r", "r", "l"]}
              rows={nets.map((n) => [n.name, num(n.requests), pct(n.bidRate), pct(n.winRate), `$${n.avgBid.toFixed(2)}`, pct(n.timeouts), money(n.revenue), <div key="b" className="w-16"><Bar value={n.revenue} max={maxNetRev} /></div>])}
            />
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="By country" note="Users, and whether their ads cover their AI. A red row means that country costs more than it earns.">
            <Table
              head={["Country", "Users", "", "Revenue / user", "AI / user", "Status"]}
              align={["l", "r", "l", "r", "r", "l"]}
              rows={[...COUNTRIES].sort((a, b) => b.users - a.users).map((c) => {
                const ok = c.revPerUser >= c.costPerUser;
                return [
                  c.name,
                  num(c.users),
                  <div key="b" className="w-16"><Bar value={c.users} max={maxCountry} /></div>,
                  money(c.revPerUser),
                  money(c.costPerUser),
                  <span key="s" className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${ok ? "bg-good/12 text-good" : "bg-bad/12 text-bad"}`}>{ok ? "✓ Covered" : "✕ Losing"}</span>,
                ];
              })}
            />
          </Card>
          <Card title="Where people come from" note="Visits and beta applications by source. Referral links convert best.">
            <Table
              head={["Source", "Visits", "Applied", "Rate", ""]}
              align={["l", "r", "r", "r", "l"]}
              rows={SOURCES.map((s) => [s.name, num(s.visits), num(s.applications), pct(s.applications / s.visits), <div key="b" className="w-20"><Bar value={s.applications} max={maxSource} /></div>])}
            />
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Beta funnel" note="From first visit to coming back.">
            <div className="flex flex-col gap-2.5">
              {FUNNEL.map((f, i) => (
                <div key={f.step} className="flex flex-col gap-1">
                  <div className="flex justify-between text-[13px]">
                    <span>{f.step}</span>
                    <span className="font-mono text-muted tabular-nums">
                      {num(f.n)}
                      {i > 0 && ` · ${pct(f.n / FUNNEL[i - 1].n)}`}
                    </span>
                  </div>
                  <span className="h-2.5 overflow-hidden rounded-r-[4px] bg-hover">
                    <span className="block h-full rounded-r-[4px] bg-series-1" style={{ width: `${(Math.log10(f.n) / Math.log10(FUNNEL[0].n)) * 100}%` }} />
                  </span>
                </div>
              ))}
              <p className="text-xs text-faint">Bar lengths use a log scale so small steps stay visible.</p>
            </div>
          </Card>
          <Card title="Most-clicked ads" note="Creative, where it showed, and click rate.">
            <Table
              head={["Ad", "Tool", "Clicks", "CTR"]}
              align={["l", "l", "r", "r"]}
              rows={TOP_CLICKED.map((t) => [<span key="c"><b className="font-medium">{t.creative}</b><small className="block text-xs text-muted">{t.format}</small></span>, t.tool, num(t.clicks), pct(t.ctr)])}
            />
          </Card>
          <Card title="Models" note="Requests and cost per model in the range.">
            <Table
              head={["Model", "Requests", "Cost", "Per request"]}
              align={["l", "r", "r", "r"]}
              rows={MODELS_USAGE.map((m) => [m.name, num(m.requests), money(m.cost), `$${(m.cost / m.requests).toFixed(4)}`])}
            />
          </Card>
        </div>

        <div className="grid gap-4">
          <Card title="Beta approvals" note="Approve in cohorts. Referrals and what they want to build help decide.">
            <Table
              head={["Applicant", "Country", "Source", "Invites", "Risk", ""]}
              align={["l", "l", "l", "r", "l", "l"]}
              rows={QUEUE.map((a) => [
                <span key="n"><b className="font-medium">{a.name}</b><small className="block max-w-[220px] truncate text-xs text-muted">{a.building}</small></span>,
                a.country,
                a.source,
                a.referrals,
                <RiskChip key="r" risk={a.risk} />,
                decisions[a.id] ? (
                  <span key="d" className={`text-xs font-medium ${decisions[a.id] === "approved" ? "text-good" : "text-muted"}`}>{decisions[a.id] === "approved" ? "Approved" : "Declined"}</span>
                ) : (
                  <span key="d" className="flex gap-1.5">
                    <button type="button" onClick={() => setDecisions((d) => ({ ...d, [a.id]: "approved" }))} className="rounded-lg bg-fg px-2.5 py-1 text-xs font-semibold text-bg">Approve</button>
                    <button type="button" onClick={() => setDecisions((d) => ({ ...d, [a.id]: "rejected" }))} className="rounded-lg border border-line px-2.5 py-1 text-xs">Decline</button>
                  </span>
                ),
              ])}
            />
          </Card>
          <Card title="Abuse watch" note="Accounts the risk scorer flagged, and what it did automatically.">
            <Table
              head={["Account", "Signal", "Score", "Action"]}
              align={["l", "l", "r", "l"]}
              rows={FLAGGED.map((f) => [<b key="a" className="font-medium">{f.account}</b>, f.signal, f.score, f.action])}
            />
            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              <button type="button" className="rounded-lg border border-bad/40 px-3 py-1.5 text-[13px] font-medium text-bad">Pause Fable 5.1</button>
              <button type="button" className="rounded-lg border border-bad/40 px-3 py-1.5 text-[13px] font-medium text-bad">Pause all AI</button>
              <span className="self-center text-xs text-faint">Kill switches. Design preview: these don&apos;t do anything yet.</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
