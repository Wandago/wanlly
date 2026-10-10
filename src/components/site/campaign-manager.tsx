"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "../icon";

type Offer = { by: "advertiser" | "wanlly"; cpmCents?: number; cpcCents?: number; note?: string; at: string };
type View = {
  campaign: {
    id: number;
    advertiser: string;
    status: "draft" | "active" | "paused" | "ended";
    format: "visual" | "suggested";
    headline: string;
    body: string;
    cta: string;
    url: string;
    color: string;
    keywords: string[];
    countries: string[];
    budgetCents: number | null;
    cpmCents: number;
    cpcCents: number;
    offerStatus: "submitted" | "countered" | "accepted" | "declined" | null;
    offers: Offer[];
    paid: boolean;
  };
  stats: { impressions: number; clicks: number; spentCents: number; daily: { day: string; impressions: number; clicks: number }[] };
  payment: string | null;
};

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const price = (o: { cpmCents?: number; cpcCents?: number }) => (o.cpcCents ? `${money(o.cpcCents)} per click` : o.cpmCents ? `${money(o.cpmCents)} per 1,000 views` : "");
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-fg";

/** What the advertiser sees at their private link: where the campaign stands, the price talks, and results. */
export function CampaignManager({ reference }: { reference: string }) {
  const [data, setData] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [counter, setCounter] = useState("");
  const [note, setNote] = useState("");
  const [resend, setResend] = useState("");
  const [resent, setResent] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/advertise/campaigns/${encodeURIComponent(reference)}`, { cache: "no-store" }).catch(() => null);
    const b = await r?.json().catch(() => ({}));
    if (!r?.ok) return setError(b?.error ?? "We couldn't load your campaign.");
    setData(b);
  }, [reference]);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    const r = await fetch(`/api/advertise/campaigns/${encodeURIComponent(reference)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const b = await r?.json().catch(() => ({}));
    setBusy(false);
    if (!r?.ok) return setError(b?.error ?? "That didn't save.");
    setData(b);
    setCounter("");
    setNote("");
  };

  if (!data)
    return (
      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-4 px-4 py-20">
        {error ? (
          <>
            <h1 className="font-display text-2xl font-semibold">{error}</h1>
            <p className="text-sm text-muted">Links change each time we email you, so use the one in your latest email from us. Lost it? We&apos;ll send fresh links.</p>
            {resent ? (
              <p className="text-sm text-good">If that email has campaigns with us, fresh links are on their way.</p>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await fetch("/api/advertise/resend", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: resend }) }).catch(() => null);
                  setResent(true);
                }}
              >
                <input id="resend-email" type="email" required value={resend} onChange={(e) => setResend(e.target.value)} placeholder="The email you used" className={input} />
                <button type="submit" className="shrink-0 rounded-full bg-fg px-4 text-sm font-semibold text-bg">
                  Send links
                </button>
              </form>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">Loading your campaign…</p>
        )}
      </main>
    );

  const { campaign: c, stats, payment } = data;
  const last = c.offers[c.offers.length - 1];
  const byClick = !!(last?.cpcCents ?? c.cpcCents);
  const stage =
    c.offerStatus === "declined"
      ? { tone: "bad", title: "We can't run this campaign", text: last?.note ?? "" }
      : c.offerStatus === "submitted"
        ? { tone: "wait", title: "With our team", text: "We usually reply within a working day. We'll email you." }
        : c.offerStatus === "countered"
          ? { tone: "you", title: "We suggested a price", text: "Accept it, or offer another." }
          : !c.paid
            ? { tone: "you", title: "Price agreed: payment next", text: "Your campaign goes live as soon as payment arrives." }
            : c.status === "active"
              ? { tone: "good", title: "Live", text: "Showing on Wanlly now." }
              : c.status === "paused"
                ? { tone: "wait", title: "Paused", text: "Resume any time." }
                : { tone: "wait", title: "Finished", text: "The budget is spent or the end date passed." };
  const toneClass = { bad: "bg-bad/10 text-bad", wait: "bg-hover text-fg", you: "bg-accent-soft text-accent", good: "bg-good/12 text-good" }[stage.tone];
  const budget = c.budgetCents ?? 0;
  const maxDay = Math.max(1, ...stats.daily.map((d) => d.impressions));

  return (
    <main className="mx-auto flex w-full max-w-[880px] flex-col gap-6 px-4 pt-12 pb-20 sm:px-6">
      <header className="flex flex-col gap-2">
        <Link href="/advertise" className="text-[13px] text-muted hover:text-fg">
          ← Advertise on Wanlly
        </Link>
        <h1 className="font-display text-[clamp(26px,4vw,36px)] leading-[1.1] font-semibold tracking-[-0.03em]">{c.headline}</h1>
        <p className="text-sm text-muted">
          {c.advertiser} · {c.format === "suggested" ? "Suggested in chat" : "Visual ads"} · campaign #{c.id}
        </p>
      </header>

      <section className={`flex flex-col gap-1 rounded-2xl px-5 py-4 ${toneClass}`}>
        <b className="text-[15px] font-semibold">{stage.title}</b>
        {stage.text && <p className="text-[13px] opacity-90">{stage.text}</p>}
      </section>

      {c.paid && (
        <section className="grid gap-3 sm:grid-cols-4">
          {[
            ["Views", stats.impressions.toLocaleString("en-US")],
            ["Clicks", stats.clicks.toLocaleString("en-US")],
            ["Click rate", stats.impressions ? `${((stats.clicks / stats.impressions) * 100).toFixed(1)}%` : "–"],
            ["Spent", `${money(stats.spentCents)}${budget ? ` of ${money(budget)}` : ""}`],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
              <span className="text-xs text-muted">{k}</span>
              <b className="font-display text-xl font-semibold tabular-nums">{v}</b>
            </div>
          ))}
          <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 sm:col-span-4">
            <span className="text-xs text-muted">Views per day, last 14 days</span>
            <div className="flex h-24 items-end gap-1" role="img" aria-label="Views per day">
              {stats.daily.map((d) => (
                <span key={d.day} title={`${d.day}: ${d.impressions} views, ${d.clicks} clicks`} className="flex-1 rounded-t-[3px] bg-series-1" style={{ height: `${Math.max(2, (d.impressions / maxDay) * 100)}%` }} />
              ))}
            </div>
          </div>
          {(c.status === "active" || c.status === "paused") && (
            <button type="button" disabled={busy} onClick={() => act({ action: c.status === "active" ? "pause" : "resume" })} className="self-start rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-faint sm:col-span-4">
              {c.status === "active" ? "Pause campaign" : "Resume campaign"}
            </button>
          )}
        </section>
      )}

      {payment && (
        <section className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
          <b className="text-[15px] font-semibold">How to pay</b>
          <p className="text-sm whitespace-pre-wrap text-muted">{payment}</p>
          <p className="text-xs text-faint">
            Amount: {money(budget)} (your budget). Include campaign #{c.id} as the reference.
          </p>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
        <b className="text-[15px] font-semibold">Price</b>
        <ol className="flex flex-col gap-2">
          {c.offers.map((o, i) => (
            <li key={i} className={`flex max-w-[85%] flex-col gap-0.5 rounded-xl px-3.5 py-2.5 text-[13px] ${o.by === "wanlly" ? "self-start border border-accent-line bg-accent-soft" : "self-end bg-hover"}`}>
              <span className="text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
                {o.by === "wanlly" ? "Wanlly" : "You"} · {when(o.at)}
              </span>
              {price(o) && <b className="font-semibold">{price(o)}</b>}
              {o.note && <span className="text-muted">{o.note}</span>}
            </li>
          ))}
        </ol>
        {c.offerStatus === "countered" && last?.by === "wanlly" && (
          <div className="flex flex-col gap-3 border-t border-line pt-3">
            <button type="button" disabled={busy} onClick={() => act({ action: "accept" })} className="self-start rounded-full bg-fg px-5 py-2.5 text-sm font-semibold text-bg disabled:opacity-60">
              Accept {price(last)}
            </button>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] text-muted">Or offer another price</span>
              <div className="flex flex-wrap gap-2">
                <input
                  id="counter-price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={counter}
                  onChange={(e) => setCounter(e.target.value)}
                  placeholder={byClick ? "US$ per click" : "US$ per 1,000 views"}
                  className={`${input} max-w-[200px]`}
                />
                <input id="counter-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="A note (optional)" className={`${input} min-w-[200px] flex-1`} />
                <button
                  type="button"
                  disabled={busy || !(Number(counter) > 0)}
                  onClick={() => act({ action: "offer", [byClick ? "cpcCents" : "cpmCents"]: Math.round(Number(counter) * 100), note })}
                  className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:border-faint disabled:opacity-50"
                >
                  Send offer
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2 text-[13px] text-muted">
        <span className="flex items-center gap-2">
          <Icon name="link" size={14} /> Opens {c.url}
        </span>
        {c.keywords.length > 0 && <span>Topics: {c.keywords.join(", ")}</span>}
        <span>Countries: {c.countries.length ? c.countries.join(", ") : "everywhere"}</span>
        <span className="text-xs text-faint">Keep this link private: anyone with it can manage this campaign. Questions? Reply to any of our emails.</span>
      </section>
      {error && <p className="text-sm text-bad">{error}</p>}
    </main>
  );
}
