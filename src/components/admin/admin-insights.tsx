"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, Card, Chip, Empty, Kpi, Pills, Table, api, btnGhost, num, pct, usd, when } from "./admin-ui";
import { NetworkSlot, useNetworkTestSwitch } from "../ads/network-slot";
import { DIRECT_SANDBOX, frameSandbox } from "../ads/network-unit";
import { NETWORK_SIZES as UNIT_SIZES, directSrc, frameUrl, sizeOf, type NetworkConfig, type NetworkSize } from "@/lib/ad-network";
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
  applicants: { channel: string; stated: string; applications: number; approved: number }[];
  campaigns: { campaign: string; channel: string; applications: number; approved: number }[];
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
      <ApplicantSources data={data} />
    </div>
  );
}

/** Where beta applicants came from: what the link or referring site says, next to what they told us. */
function ApplicantSources({ data }: { data: Traffic }) {
  const byChannel = new Map<string, { applications: number; approved: number }>();
  for (const r of data.applicants) {
    const c = byChannel.get(r.channel) ?? { applications: 0, approved: 0 };
    byChannel.set(r.channel, { applications: c.applications + r.applications, approved: c.approved + r.approved });
  }
  const channels = [...byChannel].sort((a, b) => b[1].applications - a[1].applications);
  const max = channels[0]?.[1].applications ?? 0;
  const total = data.applicants.reduce((a, r) => a + r.applications, 0);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Where beta applicants come from" note="Detected from their first visit: the utm_source on the link, or the site that sent them. Direct means no link or referrer.">
        {channels.length ? (
          <Table
            head={["Channel", "Applications", "Share", "Approved", ""]}
            numeric={[1, 2, 3]}
            rows={channels.map(([c, v]) => [c, num(v.applications), pct(v.applications / Math.max(1, total)), num(v.approved), <Bar key="b" value={v.applications} max={max} />])}
          />
        ) : (
          <Empty>No applications in this period.</Empty>
        )}
      </Card>
      <Card title="Detected vs what they said" note="The channel we detected, next to their answer to “How did you hear about Wanlly?”. A gap usually means word of mouth or a shared screenshot.">
        {data.applicants.length ? (
          <Table
            head={["Detected", "They said", "Applications", "Approved"]}
            numeric={[2, 3]}
            rows={data.applicants.map((r) => [r.channel, r.stated, num(r.applications), `${num(r.approved)} · ${pct(r.approved / Math.max(1, r.applications))}`])}
          />
        ) : (
          <Empty>No applications in this period.</Empty>
        )}
        {!!data.campaigns.length && (
          <Table head={["Campaign", "Channel", "Applications", "Approved"]} numeric={[2, 3]} rows={data.campaigns.map((r) => [<code key="c" className="font-mono text-xs">{r.campaign}</code>, r.channel, num(r.applications), num(r.approved)])} />
        )}
      </Card>
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

/** Ads in two parts: a dashboard of how ads perform, and the setup of the ad network. */
export function AdsTab({ days }: { days: 7 | 30 }) {
  const [part, setPart] = useState<"dashboard" | "setup">("dashboard");
  return (
    <div className="flex flex-col gap-4">
      <Pills
        label="Ads section"
        value={part}
        onChange={setPart}
        options={[
          ["dashboard", "Dashboard"],
          ["setup", "Setup"],
        ]}
      />
      {part === "dashboard" ? (
        <AdStats days={days} />
      ) : (
        <>
          <AdNetwork />
          <NetworkTest />
        </>
      )}
    </div>
  );
}

function AdStats({ days }: { days: 7 | 30 }) {
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

const WHERE: Record<NetworkSize, string> = {
  "300x250": "Side panel (takes turns with sponsor cards) and job cards",
  "320x50": "Phone bar (takes turns with sponsors)",
  "728x90": "Under the chat box on an empty chat, wide screens",
  "468x60": "Under the chat box on an empty chat, tablets",
  "300x600": "Side panel on tall screens",
  "336x280": "Job cards on wide screens",
  "160x600": "Not used yet",
  "320x100": "Not used yet",
};

/** The ad network: its name, who sees it, and the banner code for each size. */
function AdNetwork() {
  const [cfg, setCfg] = useState<NetworkConfig | null>(null);
  const [saved, setSaved] = useState<NetworkConfig | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(0);
  const [added, setAdded] = useState<NetworkSize[]>([]);
  useEffect(() => {
    api<{ network: NetworkConfig }>("/api/admin/network")
      .then((b) => {
        setCfg(b.network);
        setSaved(b.network);
      })
      .catch((e: Error) => setNote(e.message));
  }, []);
  if (!cfg) return <Card title="Ad network">{note ? <Empty>{note}</Empty> : <Empty>Loading…</Empty>}</Card>;
  const set = (patch: Partial<NetworkConfig>) => setCfg({ ...cfg, ...patch });
  const save = async () => {
    setBusy(true);
    setNote("");
    try {
      const b = await api<{ network: NetworkConfig }>("/api/admin/network", "PUT", cfg);
      setCfg(b.network);
      setSaved(b.network);
      setPreview((n) => n + 1);
      setNote("Saved. Changes reach the app within 5 minutes.");
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const field = "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-faint";
  return (
    <Card
      title="Ad network"
      note="Real paid banners from a network such as Adsterra or A-ADS, alongside your own campaigns. Paste each banner's code from the network's dashboard. Each one runs in a locked-down frame, so its script can't reach the app or people's accounts."
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[13px] font-medium">
          Network
          <input className={`${field} w-[180px]`} value={cfg.name} onChange={(e) => set({ name: e.target.value })} placeholder="adsterra" list="networks" />
          <datalist id="networks">
            <option value="adsterra" />
            <option value="a-ads" />
          </datalist>
        </label>
        <div className="flex flex-col gap-1 text-[13px] font-medium">
          Who sees it
          <span className="flex gap-1">
            {(
              [
                ["off", "Off"],
                ["staff", "Team only"],
                ["everyone", "Everyone"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={cfg.audience === k}
                onClick={() => set({ audience: k })}
                className={`rounded-full border px-2.5 py-1 text-xs ${cfg.audience === k ? "border-accent-line bg-accent-soft font-medium text-accent" : "border-line font-normal text-muted"}`}
              >
                {label}
              </button>
            ))}
          </span>
        </div>
        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-[13px] font-medium">
          Banner host <span className="font-normal text-faint">optional</span>
          <input className={field} value={cfg.host ?? ""} onChange={(e) => set({ host: e.target.value })} placeholder="https://wanlly-ads.yourname.workers.dev" />
        </label>
        <button type="button" className={`${btnGhost} ml-auto`} onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      {note && <p className="text-[13px] text-muted">{note}</p>}
      {!saved?.host && Object.values(saved?.units ?? {}).some((code) => !directSrc(code)) && (
        <p className="rounded-lg bg-bad/10 px-3 py-2 text-[13px] text-bad">
          Script banners (like Adsterra&apos;s) stay off in the app until a banner host is set: without one they load blank inside Wanlly&apos;s sandbox. Banners whose code is just an &lt;iframe&gt; (like A-ADS) run without it. Your sponsors fill the slots meanwhile.
        </p>
      )}
      <p className="text-xs text-faint">Start with Team only: check the banners in the app, then switch to Everyone. Slots with a network size take turns between network banners and your sponsors.</p>
      <ul className="flex flex-col">
        {UNIT_SIZES.filter((size) => cfg.units[size] !== undefined || added.includes(size)).map((size) => {
          const { w, h } = sizeOf(size);
          const live = saved?.audience !== "off" && !!saved?.units[size];
          return (
            <li key={size} className="flex flex-col gap-2 border-t border-line py-3 first:border-t-0">
              <div className="text-[13px]">
                <b className="font-semibold">{w}×{h}</b> <span className="text-muted">{WHERE[size]}</span>
              </div>
              <textarea
                className={`${field} min-h-[64px] font-mono text-[11px]`}
                value={cfg.units[size] ?? ""}
                onChange={(e) => set({ units: { ...cfg.units, [size]: e.target.value } })}
                placeholder={`Banner code for ${w}×${h}, from the network's dashboard`}
                spellCheck={false}
              />
              {live && <BannerPreview key={`${preview}-${saved?.host ?? ""}`} size={size} host={saved?.host ?? ""} direct={directSrc(saved?.units[size]) ?? ""} code={saved?.units[size] ?? ""} />}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted">Add a size:</span>
        {UNIT_SIZES.filter((size) => cfg.units[size] === undefined && !added.includes(size)).map((size) => (
          <button key={size} type="button" title={WHERE[size]} onClick={() => setAdded((xs) => [...xs, size])} className="rounded-full border border-dashed border-line px-2.5 py-0.5 font-mono text-xs text-muted hover:border-faint hover:text-fg">
            + {size.replace("x", "×")}
          </button>
        ))}
      </div>
    </Card>
  );
}

/** One saved banner, live, with what happened in this browser: shown, empty, blocked or failed. */
function BannerPreview({ size, host, direct, code }: { size: NetworkSize; host: string; direct: string; code: string }) {
  const { w, h } = sizeOf(size);
  const ref = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<{ kind: string; detail?: string }>({ kind: "loading" });
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (direct || e.source !== ref.current?.contentWindow) return;
      const m = e.data as { wanllyAd?: string; detail?: string };
      if (!m?.wanllyAd) return;
      // Keep the first problem; "filled" always wins.
      setStatus((s) => (m.wanllyAd === "filled" || s.kind === "loading" || (s.kind === "empty" && m.wanllyAd !== "empty") ? { kind: m.wanllyAd!, detail: m.detail } : s));
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [direct]);
  const text: Record<string, string> = {
    loading: "Loading…",
    direct: "Loaded from the network's own site. Runs in the app without a banner host.",
    filled: "The network's ad frame loaded. If the box still looks empty, its ad needs storage, which the sandbox blocks: set up the banner host above.",
    empty: "No ad came back. The network had nothing to show, or the site isn't serving yet.",
    blocked: "The network's script didn't load in this browser, usually an ad-blocking extension. Try a private window with extensions off.",
    error: "The network's script failed while running. If it mentions storage, cookies or SecurityError, set up a banner host (see the docs).",
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="overflow-x-auto pb-1">
        <iframe
          ref={ref}
          title={`${w}×${h} banner preview`}
          src={direct || (host ? frameUrl(host, code) : `/api/ads/unit?size=${size}`)}
          width={w}
          height={h}
          sandbox={direct ? DIRECT_SANDBOX : frameSandbox(host)}
          onLoad={direct ? () => setStatus({ kind: "direct" }) : undefined}
          className="block border border-dashed border-line"
          style={{ width: w, height: h }}
        />
      </div>
      <small className={`text-xs ${status.kind === "filled" || status.kind === "direct" ? "text-good" : status.kind === "loading" ? "text-faint" : "text-bad"}`}>
        {text[status.kind] ?? status.kind}
        {status.detail && <code className="ml-1 font-mono text-[11px] break-all text-muted">{status.detail}</code>}
      </small>
    </div>
  );
}

/** Standard network sizes and where each one fits in Wanlly today. */
const NETWORK_SIZES: { w: number; h: number; name: string; where: string }[] = [
  { w: 300, h: 250, name: "Medium rectangle", where: "Side panel and job cards. The size most demand buys." },
  { w: 336, h: 280, name: "Large rectangle", where: "Job cards on wide screens." },
  { w: 320, h: 50, name: "Mobile banner", where: "Phone bar at the bottom." },
  { w: 320, h: 100, name: "Large mobile banner", where: "Not used yet. Would need a taller phone bar." },
  { w: 300, h: 600, name: "Half page", where: "Not used yet. Fits the side panel on tall screens, instead of the cover card." },
  { w: 728, h: 90, name: "Leaderboard", where: "Not used yet. Would need a strip above or below the page." },
  { w: 160, h: 600, name: "Wide skyscraper", where: "Not used. The side panel is wide enough for 300 px ads." },
  { w: 970, h: 250, name: "Billboard", where: "Not used. Only on the public pages, if ever." },
];

/** Google test ads in every standard size, and a switch to show them in the app on this device. */
function NetworkTest() {
  const [on, setOn] = useNetworkTestSwitch();
  const [gallery, setGallery] = useState(false);
  return (
    <Card
      title="Ad network test"
      note="Google's public test ads, served by Google Publisher Tag, the same way AdSense or Ad Manager ads will be. They never pay. Use them to check sizes and layout before an account is approved."
      actions={
        <button type="button" className={btnGhost} onClick={() => setOn(!on)} aria-pressed={on}>
          {on ? "Hide test ads in the app" : "Show test ads in the app"}
        </button>
      }
    >
      <p className="text-[13px] text-muted">
        {on
          ? "On for this device. Open chat or design: the side panel, job cards and the phone bar now show Google test ads with their size above them. Only staff see them."
          : "Switch on to see Google test ads in the app's ad slots on this device. Only staff accounts see them; everyone else keeps seeing sponsors."}
      </p>
      {!gallery ? (
        <button type="button" className={`${btnGhost} self-start`} onClick={() => setGallery(true)}>
          Load every standard size
        </button>
      ) : (
        <ul className="flex flex-col">
          {NETWORK_SIZES.map((s) => (
            <li key={`${s.w}x${s.h}`} className="flex flex-col gap-2 border-t border-line py-3 first:border-t-0">
              <div className="text-[13px]">
                <b className="font-semibold">
                  {s.name} · {s.w}×{s.h}
                </b>{" "}
                <span className="text-muted">{s.where}</span>
              </div>
              <div className="overflow-x-auto pb-1">
                <NetworkSlot w={s.w} h={s.h} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
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
