"use client";

import { useEffect, useState } from "react";
import { Card, Empty, Kpi, Table, api, btnDark, btnGhost, num, usd } from "./admin-ui";
import { TrendChart } from "./trend-chart";

/*
 * Real money and real usage: income that actually arrived (sold campaigns, Adsterra's report,
 * income recorded by hand), what the models really cost from their tokens, and what one credit
 * buys on each model.
 */

type Money = {
  days: number;
  usdPerCredit: number;
  daily: { day: string; campaigns: number; network: number; manual: number; cost: number; credits: number }[];
  models: { model: string; name: string; replies: number; input: number; output: number; credits: number; cost: number }[];
  rates: { model: string; name: string; credits: number; outPerCredit: number; inPerCredit: number; costOut: number; costIn: number }[];
  network: { connected: boolean; error: string | null };
  entries: { id: string; day: string; source: string; usd: number; note: string }[];
};

const S1 = "var(--series-1)";
const S2 = "var(--series-2)";
const tokens = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e4 ? `${Math.round(v / 1e3)}k` : num(v));
const input = "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-faint";

export function MoneyPanel({ days }: { days: 7 | 30 }) {
  const [data, setData] = useState<Money | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    api<Money>(`/api/admin/money?days=${days}`)
      .then((d) => live && setData(d))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [days, tick]);
  if (error) return <Empty>{error}</Empty>;
  if (!data) return <Empty>Loading real numbers…</Empty>;

  const t = data.daily.reduce(
    (a, d) => ({ campaigns: a.campaigns + d.campaigns, network: a.network + d.network, manual: a.manual + d.manual, cost: a.cost + d.cost, credits: a.credits + d.credits }),
    { campaigns: 0, network: 0, manual: 0, cost: 0, credits: 0 },
  );
  const revenue = t.campaigns + t.network + t.manual;
  const tk = data.models.reduce((a, m) => ({ input: a.input + m.input, output: a.output + m.output }), { input: 0, output: 0 });
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Real revenue" value={usd(revenue)} sub={`${usd(revenue / data.days)} a day`} />
        <Kpi label="Real AI cost" value={usd(t.cost)} sub="paid models only; free tiers cost $0" />
        <Kpi label="Profit" value={usd(revenue - t.cost)} sub={revenue >= t.cost ? "ads cover the AI" : "AI costs more than ads bring in"} />
        <Kpi label="Tokens used" value={tokens(tk.input + tk.output)} sub={`${tokens(tk.input)} read · ${tokens(tk.output)} written`} />
      </div>
      <Card title="Real revenue and AI cost" note="Per day, in US dollars. Revenue is money that actually arrived or was reported, not an estimate.">
        <TrendChart
          label={`Real revenue and AI cost per day, last ${days} days`}
          days={data.daily.map((d) => d.day)}
          format={usd}
          series={[
            { key: "rev", label: "Revenue", color: S1, values: data.daily.map((d) => d.campaigns + d.network + d.manual) },
            { key: "cost", label: "AI cost", color: S2, values: data.daily.map((d) => d.cost) },
          ]}
        />
      </Card>
      <Card title="Where the money came from" note="Sold campaigns at their agreed price per 1,000 views, Adsterra's own report, and income you record below.">
        <Table
          head={["Source", "This range", "How it's counted"]}
          numeric={[1]}
          rows={[
            ["Sold campaigns", usd(t.campaigns), "Views × each campaign's agreed price"],
            [
              "Adsterra",
              data.network.connected ? usd(t.network) : "–",
              data.network.connected ? "From Adsterra's publisher API" : data.network.error ?? "Add the ADSTERRA_API_KEY secret (Adsterra → Settings → API) to pull real earnings",
            ],
            ["Recorded by hand", usd(t.manual), "Affiliate commissions, sponsorships, other payouts"],
          ]}
        />
      </Card>
      <RecordIncome entries={data.entries} onChange={() => setTick((n) => n + 1)} />
      <Card title="Tokens by model" note="What each model read and wrote in this range, the credits people paid for it, and the real cost. Design versions count once migration 0014 has run.">
        {data.models.length ? (
          <Table
            head={["Model", "Replies", "Tokens read", "Tokens written", "Credits charged", "Tokens per credit", "Real cost", "Cost per credit"]}
            numeric={[1, 2, 3, 4, 5, 6, 7]}
            rows={data.models.map((m) => [
              m.name,
              num(m.replies),
              tokens(m.input),
              tokens(m.output),
              num(m.credits),
              m.credits ? tokens(Math.round((m.input + m.output) / m.credits)) : "–",
              usd(m.cost),
              m.credits ? `$${(m.cost / m.credits).toFixed(4)}` : "–",
            ])}
          />
        ) : (
          <Empty>No model use in this range yet.</Empty>
        )}
      </Card>
      <Card title="What one credit buys" note={`A credit is worth $${data.usdPerCredit} of ad money. If a model's tokens for one credit cost more than that, Wanlly charges by the real bill instead, so no model runs at a loss.`}>
        <Table
          head={["Model", "Credits per unit", "Tokens written per credit", "Tokens read per credit", "Our cost: written", "Our cost: read"]}
          numeric={[1, 2, 3, 4, 5]}
          rows={data.rates.map((r) => [
            r.name,
            num(r.credits),
            num(r.outPerCredit),
            num(r.inPerCredit),
            <span key="o" className={r.costOut > data.usdPerCredit ? "text-bad" : ""}>{r.costOut ? `$${r.costOut.toFixed(4)}` : "free"}</span>,
            <span key="i" className={r.costIn > data.usdPerCredit ? "text-bad" : ""}>{r.costIn ? `$${r.costIn.toFixed(4)}` : "free"}</span>,
          ])}
        />
      </Card>
    </div>
  );
}

function RecordIncome({ entries, onChange }: { entries: Money["entries"]; onChange: () => void }) {
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    setMsg("");
    try {
      await api("/api/admin/money", "POST", { day, source, usd: Number(amount), note });
      setSource("");
      setAmount("");
      setNote("");
      onChange();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Record income" note="For money without an automatic report: affiliate commissions, a sponsor paying by M-Pesa, a network payout. In US dollars.">
      <div className="flex flex-wrap items-end gap-2">
        <input type="date" aria-label="Date" value={day} onChange={(e) => setDay(e.target.value)} className={input} />
        <input aria-label="Source" placeholder="Source, e.g. Jumia affiliate" value={source} maxLength={40} onChange={(e) => setSource(e.target.value)} className={`${input} min-w-[180px] flex-1`} />
        <input aria-label="Amount in US dollars" placeholder="Amount ($)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${input} w-[110px]`} />
        <input aria-label="Note" placeholder="Note (optional)" value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} className={`${input} min-w-[160px] flex-1`} />
        <button type="button" onClick={add} disabled={busy || !source.trim() || !(Number(amount) > 0)} className={btnDark}>
          {busy ? "Saving…" : "Add"}
        </button>
      </div>
      {msg && <p className="text-[13px] text-bad">{msg}</p>}
      {entries.length > 0 && (
        <Table
          head={["Date", "Source", "Amount", "Note", ""]}
          numeric={[2]}
          rows={entries.map((e) => [
            e.day,
            e.source,
            usd(e.usd),
            <span key="n" className="text-muted">{e.note}</span>,
            <button
              key="x"
              type="button"
              className={btnGhost}
              onClick={async () => {
                if (!window.confirm(`Remove ${e.source} (${usd(e.usd)})?`)) return;
                await api(`/api/admin/money?id=${encodeURIComponent(e.id)}`, "DELETE").catch(() => {});
                onChange();
              }}
            >
              Remove
            </button>,
          ])}
        />
      )}
    </Card>
  );
}
