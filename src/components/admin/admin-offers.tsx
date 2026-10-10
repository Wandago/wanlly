"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Empty, Loading, Pills, api, btnDark, btnGhost, usd, when } from "./admin-ui";

type Offer = { by: "advertiser" | "wanlly"; cpmCents?: number; cpcCents?: number; note?: string; at: string };
type Row = {
  id: number;
  advertiser: string;
  email: string | null;
  status: string;
  format: "visual" | "suggested";
  headline: string;
  body: string;
  cta: string;
  url: string;
  color: string;
  image: string | null;
  keywords: string[];
  countries: string[];
  budgetCents: number | null;
  cpmCents: number;
  cpcCents: number;
  offerStatus: "submitted" | "countered" | "accepted" | "declined" | null;
  offers: Offer[];
  paid: boolean;
  impressions: number;
  clicks: number;
  spentCents: number;
  createdAt: string;
};

const price = (o: { cpmCents?: number; cpcCents?: number }) => (o.cpcCents ? `${usd(o.cpcCents / 100)}/click` : o.cpmCents ? `${usd(o.cpmCents / 100)} CPM` : "");
const STAGE: Record<string, [string, string]> = {
  submitted: ["Your move", "bg-accent-soft text-accent"],
  countered: ["Waiting on them", "bg-hover text-muted"],
  accepted: ["Agreed", "bg-good/12 text-good"],
  declined: ["Declined", "bg-hover text-faint"],
};

/** Self-serve campaigns: answer price offers, confirm payment to go live, watch spend against budget. */
export function OffersPanel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [show, setShow] = useState<"open" | "live" | "all">("open");
  const load = useCallback(async () => {
    try {
      setRows((await api<{ offers: Row[] }>("/api/admin/offers")).offers);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);
  const shown = (rows ?? []).filter((r) =>
    show === "all" ? true : show === "live" ? r.paid : r.offerStatus === "submitted" || r.offerStatus === "countered" || (r.offerStatus === "accepted" && !r.paid),
  );
  const waiting = (rows ?? []).filter((r) => r.offerStatus === "submitted" || (r.offerStatus === "accepted" && !r.paid)).length;

  return (
    <Card
      title={`Self-serve offers${waiting ? ` · ${waiting} need you` : ""}`}
      note="Campaigns advertisers built at /advertise/create. Accept their price, counter, or decline; confirm payment to put it live. They're emailed each step."
      actions={
        <Pills
          label="Show"
          value={show}
          onChange={setShow}
          options={[
            ["open", "In talks"],
            ["live", "Paid"],
            ["all", "All"],
          ]}
        />
      }
    >
      {error ? <Empty>{error}</Empty> : !rows ? <Loading /> : !shown.length ? <Empty>Nothing here yet.</Empty> : <div className="flex flex-col">{shown.map((r) => <OfferRow key={r.id} r={r} onDone={load} />)}</div>}
    </Card>
  );
}

function OfferRow({ r, onDone }: { r: Row; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [counter, setCounter] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const last = r.offers[r.offers.length - 1];
  const byClick = !!(last?.cpcCents ?? r.cpcCents);
  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMsg("");
    try {
      await api(`/api/admin/offers/${r.id}`, "POST", body);
      setCounter("");
      setNote("");
      onDone();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const [label, tone] = STAGE[r.offerStatus ?? "submitted"] ?? STAGE.submitted;
  const budget = r.budgetCents ?? 0;
  return (
    <article className="flex flex-col gap-3 border-t border-line py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start gap-3">
        {r.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.image} alt="" className="size-12 rounded-lg object-cover" />
        ) : (
          <span className="grid size-12 place-items-center rounded-lg text-sm font-bold text-white" style={{ background: r.color }}>
            {r.advertiser.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1 basis-[260px]">
          <div className="flex flex-wrap items-center gap-2">
            <b className="font-semibold">{r.advertiser}</b>
            <span className="text-xs text-muted">{r.email}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>
            {r.paid && <span className="rounded-full bg-hover px-2 py-0.5 text-[11px] text-muted">{r.status}</span>}
          </div>
          <p className="text-[13px] font-medium">{r.headline}</p>
          <p className="text-xs text-muted">
            #{r.id} · {r.format === "suggested" ? "Suggested in chat" : "Visual"} · budget {usd(budget / 100)} · {r.countries.length ? r.countries.join(" ") : "all countries"}
            {r.keywords.length ? ` · topics: ${r.keywords.join(", ")}` : ""} ·{" "}
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              link
            </a>
          </p>
          {r.paid && (
            <p className="text-xs text-muted">
              {r.impressions.toLocaleString()} views · {r.clicks.toLocaleString()} clicks · spent {usd(r.spentCents / 100)} of {usd(budget / 100)}
            </p>
          )}
        </div>
      </div>
      <ol className="flex flex-wrap gap-1.5 text-xs">
        {r.offers.map((o, i) => (
          <li key={i} className={`rounded-lg px-2 py-1 ${o.by === "wanlly" ? "bg-accent-soft" : "bg-hover"}`} title={o.note}>
            {o.by === "wanlly" ? "Us" : "Them"}: {price(o) || o.note} <span className="text-faint">{when(o.at)}</span>
          </li>
        ))}
      </ol>
      {last?.note && last.by === "advertiser" && <p className="text-[13px] text-muted">“{last.note}”</p>}
      {(r.offerStatus === "submitted" || r.offerStatus === "countered") && (
        <div className="flex flex-wrap items-center gap-1.5">
          {r.offerStatus === "submitted" && (
            <button type="button" className={btnDark} disabled={busy} onClick={() => act({ action: "accept", note })}>
              Accept {price(last)}
            </button>
          )}
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={counter}
            onChange={(e) => setCounter(e.target.value)}
            placeholder={byClick ? "$ per click" : "$ per 1,000"}
            aria-label="Counter price"
            className="w-28 rounded-lg border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-faint"
          />
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Note to them (optional)" aria-label="Note" className="min-w-[160px] flex-1 rounded-lg border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-faint" />
          <button type="button" className={btnGhost} disabled={busy || !(Number(counter) > 0)} onClick={() => act({ action: "counter", [byClick ? "cpcCents" : "cpmCents"]: Math.round(Number(counter) * 100), note })}>
            Counter
          </button>
          <button type="button" className={btnGhost} disabled={busy} onClick={() => act({ action: "decline", note })}>
            Decline
          </button>
        </div>
      )}
      {r.offerStatus === "accepted" && !r.paid && (
        <button type="button" className={`${btnDark} self-start`} disabled={busy} onClick={() => act({ action: "paid" })}>
          Payment received: go live
        </button>
      )}
      {msg && <p className="text-xs text-bad">{msg}</p>}
    </article>
  );
}
