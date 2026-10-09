"use client";

import { useEffect, useState } from "react";
import { Bar, Card, Chip, Empty, Kpi, Table, api, btnGhost, num, pct, usd, when } from "./admin-ui";
import { TrendChart } from "./trend-chart";

/* Traffic, ads and revenue, and abuse: the admin tabs that read what the app records. */

function useData<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    api<T>(url)
      .then((d) => {
        if (!live) return;
        setData(d);
        setError("");
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [url, tick]);
  return { data, error, reload: () => setTick((t) => t + 1) };
}

const S1 = "var(--series-1)";
const S2 = "var(--series-2)";
const country = (code: string) => {
  if (code === "??" || code === "XX" || code === "T1") return "Unknown";
  try {
    return new Intl.DisplayNames(undefined, { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
};
const PLACEMENT_LABEL: Record<string, string> = {
  rail_cover: "Right panel · cover card",
  rail_banner: "Right panel · banner",
  sidebar_card: "Left sidebar · card",
  phone_banner: "Phone · bottom banner",
  job_card: "While you wait · card",
  job_line: "After a result · line",
  unlock: "Video · start of day card",
  earn_dialog: "Video · earn sheet",
  gate: "Video · out of credits",
};

type Traffic = {
  daily: { day: string; views: number; visitors: number }[];
  pages: { path: string; views: number; visitors: number }[];
  sources: { source: string; views: number; visitors: number }[];
  countries: { country: string; visitors: number; signups: number }[];
  devices: { device: string; visitors: number }[];
};

export function TrafficTab({ days }: { days: 7 | 30 }) {
  const { data, error } = useData<Traffic>(`/api/admin/traffic?days=${days}`);
  if (error) return <Empty>{error}</Empty>;
  if (!data) return <Empty>Loading…</Empty>;
  const sum = (k: "views" | "visitors") => data.daily.reduce((a, d) => a + d[k], 0);
  const today = data.daily[data.daily.length - 1];
  const totalDevices = data.devices.reduce((a, d) => a + d.visitors, 0);
  const maxPage = data.pages[0]?.views ?? 0;
  const maxSource = data.sources[0]?.visitors ?? 0;
  const maxCountry = data.countries[0]?.visitors ?? 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Visitors today" value={today?.visitors ?? 0} sub={`${num(today?.views ?? 0)} page views`} />
        <Kpi label={`Visitors, ${days} days`} value={sum("visitors")} sub="daily visitors added up" />
        <Kpi label={`Page views, ${days} days`} value={sum("views")} sub={`${(sum("views") / Math.max(1, sum("visitors"))).toFixed(1)} per visitor`} />
        <Kpi label="On phones" value={pct((data.devices.find((d) => d.device === "mobile")?.visitors ?? 0) / Math.max(1, totalDevices))} sub="of visitors" />
      </div>
      <Card title="Visitors per day" note="Counted without cookies. A visitor is one browser on one network for one UTC day.">
        <TrendChart label={`Visitors per day, last ${days} days`} days={data.daily.map((d) => d.day)} series={[{ key: "v", label: "Visitors", color: S1, values: data.daily.map((d) => d.visitors) }]} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Pages" note="Most viewed first.">
          {data.pages.length ? (
            <Table head={["Page", "Views", "Visitors", ""]} numeric={[1, 2]} rows={data.pages.map((p) => [<code key="p" className="font-mono text-xs">{p.path}</code>, num(p.views), num(p.visitors), <Bar key="b" value={p.views} max={maxPage} />])} />
          ) : (
            <Empty>No visits yet.</Empty>
          )}
        </Card>
        <Card title="Where visitors come from" note="The referring site, or the utm_source in your links. Direct means typed or app links.">
          {data.sources.length ? (
            <Table head={["Source", "Visitors", "Views", ""]} numeric={[1, 2]} rows={data.sources.map((s) => [s.source, num(s.visitors), num(s.views), <Bar key="b" value={s.visitors} max={maxSource} />])} />
          ) : (
            <Empty>No visits yet.</Empty>
          )}
        </Card>
        <Card title="Countries" note="Visitors from the network, and sign-ups in the same period.">
          {data.countries.length ? (
            <Table
              head={["Country", "Visitors", "Sign-ups", "Sign-up rate", ""]}
              numeric={[1, 2, 3]}
              rows={data.countries.map((c) => [country(c.country), num(c.visitors), num(c.signups), pct(c.signups / Math.max(1, c.visitors)), <Bar key="b" value={c.visitors} max={maxCountry} />])}
            />
          ) : (
            <Empty>No visits yet.</Empty>
          )}
        </Card>
        <Card title="Devices">
          {data.devices.length ? (
            <Table head={["Device", "Visitors", "Share", ""]} numeric={[1, 2]} rows={data.devices.map((d) => [<span key="d" className="capitalize">{d.device}</span>, num(d.visitors), pct(d.visitors / Math.max(1, totalDevices)), <Bar key="b" value={d.visitors} max={totalDevices} />])} />
          ) : (
            <Empty>No visits yet.</Empty>
          )}
          <p className="text-xs text-faint">Tip: add ?utm_source=tiktok (or instagram, x, whatsapp) to links you share, so each channel shows up above.</p>
        </Card>
      </div>
    </div>
  );
}

type Ads = {
  assumptions: { ecpm: { native: number; display: number; rewarded: number }; usdPerCredit: number };
  reportedRevenue: number;
  daily: { day: string; impressions: number; clicks: number; videos: number; revenue: number; cost: number }[];
  placements: { placement: string; format: string; impressions: number; clicks: number; started: number; completed: number; revenue: number }[];
  creatives: { creative: string; impressions: number; clicks: number }[];
};

export function AdsTab({ days }: { days: 7 | 30 }) {
  const { data, error } = useData<Ads>(`/api/admin/ads?days=${days}`);
  if (error) return <Empty>{error}</Empty>;
  if (!data) return <Empty>Loading…</Empty>;
  const t = data.daily.reduce((a, d) => ({ impressions: a.impressions + d.impressions, clicks: a.clicks + d.clicks, videos: a.videos + d.videos, revenue: a.revenue + d.revenue, cost: a.cost + d.cost }), { impressions: 0, clicks: 0, videos: 0, revenue: 0, cost: 0 });
  const e = data.assumptions.ecpm;
  const maxRev = Math.max(0, ...data.placements.map((p) => p.revenue));
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] text-muted">
        <b className="font-medium text-fg">Revenue here is an estimate.</b> House ads earn nothing; directly sold campaigns and, later, ad networks bring real money
        (real so far in this range: {usd(data.reportedRevenue)}). Estimates use ${e.native} per 1,000 native views, ${e.display} per 1,000 banner views and ${e.rewarded} per 1,000 finished videos.
        Model cost is credits used × ${data.assumptions.usdPerCredit}.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Ad views" value={t.impressions} sub="half on screen for 1s+" />
        <Kpi label="Clicks" value={t.clicks} sub={`${pct(t.clicks / Math.max(1, t.impressions))} click rate`} />
        <Kpi label="Videos finished" value={t.videos} />
        <Kpi label="Est. revenue" value={usd(t.revenue)} sub={`${usd(t.revenue / days)} a day`} />
        <Kpi label="Est. model cost" value={usd(t.cost)} sub={t.revenue >= t.cost ? "covered by ads" : "more than ads bring in"} />
      </div>
      <Card title="Estimated revenue and model cost" note="Per day, in US dollars. When the blue line is above the orange one, ads cover the AI.">
        <TrendChart
          label={`Estimated revenue and model cost per day, last ${days} days`}
          days={data.daily.map((d) => d.day)}
          format={usd}
          series={[
            { key: "rev", label: "Est. revenue", color: S1, values: data.daily.map((d) => d.revenue) },
            { key: "cost", label: "Est. model cost", color: S2, values: data.daily.map((d) => d.cost) },
          ]}
        />
      </Card>
      <Card title="By placement" note="Where ads sit, how often they're seen and clicked, and for videos how many are finished.">
        {data.placements.length ? (
          <Table
            head={["Placement", "Format", "Views", "Clicks", "Click rate", "Videos started", "Finished", "Est. revenue", ""]}
            numeric={[2, 3, 4, 5, 6, 7]}
            rows={data.placements.map((p) => [
              PLACEMENT_LABEL[p.placement] ?? p.placement,
              <span key="f" className="text-muted capitalize">{p.format}</span>,
              num(p.impressions),
              num(p.clicks),
              p.impressions ? pct(p.clicks / p.impressions) : "–",
              p.started ? num(p.started) : "–",
              p.started ? `${num(p.completed)} · ${pct(p.completed / p.started)}` : "–",
              usd(p.revenue),
              <Bar key="b" value={p.revenue} max={maxRev} />,
            ])}
          />
        ) : (
          <Empty>No ad activity yet.</Empty>
        )}
      </Card>
      <Card title="By ad" note="Which sponsors get seen and clicked.">
        {data.creatives.length ? (
          <Table head={["Ad", "Views", "Clicks", "Click rate"]} numeric={[1, 2, 3]} rows={data.creatives.map((c) => [c.creative, num(c.impressions), num(c.clicks), pct(c.clicks / Math.max(1, c.impressions))])} />
        ) : (
          <Empty>No ad views yet.</Empty>
        )}
      </Card>
    </div>
  );
}

type Abuse = {
  flags: { userId: string; email: string | null; status: string; rule: string; detail: string }[];
  switches: { key: "earningPaused" | "spendingPaused"; on: boolean }[];
  canSwitch: boolean;
  log: { actor: string; action: string; target: string; detail: Record<string, unknown>; at: string }[];
};
const SWITCH: Record<string, [string, string]> = {
  earningPaused: ["Pause earning", "Stops every account earning credits from videos."],
  spendingPaused: ["Pause all AI", "Stops every account using models. Use if costs spike or a model misbehaves."],
};

export function AbuseTab({ onOpenPerson }: { onOpenPerson: (q: string) => void }) {
  const { data, error, reload } = useData<Abuse>("/api/admin/abuse");
  const [note, setNote] = useState("");
  if (error) return <Empty>{error}</Empty>;
  if (!data) return <Empty>Loading…</Empty>;

  const flip = async (key: string, on: boolean) => {
    const reason = window.prompt(`${on ? "Turn on" : "Turn off"} "${SWITCH[key][0]}" for everyone? Give a reason for the log.`);
    if (!reason?.trim()) return;
    try {
      await api("/api/admin/flags", "POST", { key, on, reason });
      reload();
    } catch (e) {
      setNote((e as Error).message);
    }
  };
  const people = new Set(data.flags.map((f) => f.userId)).size;

  return (
    <div className="flex flex-col gap-4">
      <Card title="Emergency switches" note="These apply to everyone at once and take effect on the next request.">
        {note && <p className="text-[13px] text-bad">{note}</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {data.switches.map((s) => (
            <div key={s.key} className={`flex items-center gap-3 rounded-xl border p-3 ${s.on ? "border-bad/40 bg-bad/5" : "border-line"}`}>
              <div className="min-w-0 flex-1 text-[13px]">
                <b className="block font-semibold">
                  {SWITCH[s.key][0]} {s.on && <span className="ml-1 rounded-full bg-bad/12 px-2 py-0.5 text-xs font-medium text-bad">On</span>}
                </b>
                <span className="text-xs text-muted">{SWITCH[s.key][1]}</span>
              </div>
              {data.canSwitch && (
                <button
                  type="button"
                  onClick={() => flip(s.key, !s.on)}
                  className={s.on ? btnGhost : "rounded-lg border border-bad/40 px-2.5 py-1 text-xs font-medium text-bad"}
                >
                  {s.on ? "Turn off" : "Turn on"}
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>
      <Card
        title={`Flagged accounts${data.flags.length ? ` · ${people}` : ""}`}
        note="Patterns from the last 7 days. Flags never act on their own: open the person and decide."
      >
        {data.flags.length ? (
          <Table
            head={["Account", "Rule", "What we saw", "Status", ""]}
            rows={data.flags.map((f) => [
              <span key="a" className="block max-w-[220px] truncate">{f.email ?? f.userId}</span>,
              <b key="r" className="font-medium whitespace-nowrap">{f.rule}</b>,
              <span key="d" className="text-muted">{f.detail}</span>,
              <Chip key="s" s={f.status} />,
              <button key="o" type="button" className={btnGhost} onClick={() => onOpenPerson(f.email ?? f.userId)}>
                Open
              </button>,
            ])}
          />
        ) : (
          <Empty>Nothing flagged in the last 7 days.</Empty>
        )}
        <details className="text-xs text-muted">
          <summary className="cursor-pointer">What each rule looks for</summary>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
            <li>Shared device: three or more accounts on the same browser and network on the same day.</li>
            <li>Video limit, often: reached the daily video limit on two or more days.</li>
            <li>Abandoned videos: started 15+ videos but finished under 30% (often many tabs at once).</li>
            <li>Country hopping: ads from three or more countries in a week (VPNs or shared logins).</li>
            <li>New and earning fast: 80+ credits in the first two days.</li>
            <li>Scripted timing: 10+ videos finished at almost exactly the shortest allowed time.</li>
          </ul>
        </details>
      </Card>
      <Card title="Team activity" note="Every change made from this page, newest first. It can't be edited.">
        {data.log.length ? (
          <Table
            head={["When", "Who", "What", "Details"]}
            rows={data.log.map((l) => [
              <span key="w" className="whitespace-nowrap text-muted">{when(l.at)}</span>,
              <span key="u" className="block max-w-[180px] truncate">{l.actor}</span>,
              <code key="a" className="font-mono text-xs">{l.action}</code>,
              <span key="d" className="text-muted">{[l.target, ...Object.values(l.detail ?? {}).map(String)].join(" · ")}</span>,
            ])}
          />
        ) : (
          <Empty>No changes yet.</Empty>
        )}
      </Card>
    </div>
  );
}
