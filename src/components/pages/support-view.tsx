"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/lib/workspace-store";
import { DisplaySlot } from "../ads/display-slot";
import { PageFrame, Panel, btnDark, btnGhost, chip } from "./page-frame";

type Ticket = { id: number; subject: string; category: string; status: "open" | "answered" | "closed"; createdAt: string; updatedAt: string; messages?: number };
type Msg = { id: number; fromStaff: boolean; body: string; createdAt: string };

export const CATEGORIES: [string, string][] = [
  ["bug", "Something's broken"],
  ["credits", "Credits or ads rewards"],
  ["account", "Account or sign-in"],
  ["builder", "Builder, code or GitHub"],
  ["ads", "An ad I saw"],
  ["idea", "An idea"],
  ["other", "Something else"],
];
export const STATUS_LABEL = { open: "Waiting on us", answered: "We replied", closed: "Closed" } as const;
const input = "w-full rounded-lg border border-line bg-bg px-3 py-2 text-[13px] outline-none focus:border-faint";
const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  return s < 90 ? "just now" : s < 5400 ? `${Math.round(s / 60)} min ago` : s < 129600 ? `${Math.round(s / 3600)} h ago` : new Date(iso).toLocaleDateString();
};

export function SupportView() {
  const { dispatch } = useWorkspace();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/support", { cache: "no-store" }).catch(() => null);
    const b = await r?.json().catch(() => ({}));
    if (!r?.ok) return setError(b?.error ?? "Couldn't load your tickets.");
    setTickets(b.tickets);
    setError("");
  }, []);
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("ticket"));
    queueMicrotask(() => {
      if (id > 0) setOpen(id);
      void load();
    });
  }, [load]);
  useEffect(() => {
    if (tickets && !tickets.length) queueMicrotask(() => setComposing(true));
  }, [tickets]);

  return (
    <PageFrame
      title="Help and support"
      subtitle="Raise an issue and the Wanlly team replies here and by email."
      actions={
        <button type="button" className={btnDark} onClick={() => (setComposing(true), setOpen(null))}>
          New ticket
        </button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Your tickets">
            {error ? (
              <p className="text-[13px] text-bad">{error}</p>
            ) : !tickets ? (
              <p className="text-[13px] text-faint">Loading…</p>
            ) : !tickets.length ? (
              <p className="text-[13px] text-muted">No tickets yet.</p>
            ) : (
              <ul className="-mx-2 flex flex-col">
                {tickets.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => (setOpen(t.id), setComposing(false))}
                      className={`flex w-full flex-col gap-1 rounded-lg px-2 py-2 text-left hover:bg-hover ${open === t.id ? "bg-hover" : ""}`}
                    >
                      <span className="flex items-center gap-2">
                        <b className="min-w-0 flex-1 truncate text-[13px] font-semibold">{t.subject}</b>
                        <span className={`${chip} ${t.status === "answered" ? "!bg-accent-soft !text-accent" : ""}`}>{STATUS_LABEL[t.status]}</span>
                      </span>
                      <span className="text-xs text-faint">
                        #{t.id} · {ago(t.updatedAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <DisplaySlot placement="support_banner" sizes={["300x250", "320x100", "320x50"]} />
        </div>
        <div className="min-w-0">
          {composing || !open ? (
            <NewTicket
              onDone={(id) => {
                dispatch({ type: "toast", text: "Ticket raised. We'll reply here and by email." });
                setComposing(false);
                setOpen(id);
                void load();
              }}
            />
          ) : (
            <Thread key={open} id={open} onChange={load} />
          )}
        </div>
      </div>
    </PageFrame>
  );
}

function NewTicket({ onDone }: { onDone: (id: number) => void }) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("bug");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    setBusy(true);
    setError("");
    const page = document.referrer && new URL(document.referrer).origin === location.origin ? new URL(document.referrer).pathname : "";
    const r = await fetch("/api/support", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject, category, body, page }) }).catch(() => null);
    const b = await r?.json().catch(() => ({}));
    setBusy(false);
    if (!r?.ok) return setError(b?.error ?? "Couldn't send. Check your connection.");
    onDone(b.ticket.id);
  };
  return (
    <Panel title="Raise a ticket" note="The more detail, the faster we can fix it: what you did, what you expected, and what happened instead.">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="flex flex-col gap-1 text-[13px] font-medium">
          What&apos;s it about?
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
            {CATEGORIES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-medium">
          Title
          <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={140} placeholder="e.g. Credits didn't arrive after an ad" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-medium">
          Details
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={7} placeholder="What happened? Include links or the project name if it helps." className={`${input} resize-y`} />
        </label>
        {error && <p className="text-[13px] text-bad">{error}</p>}
        <button type="submit" disabled={busy || subject.trim().length < 4 || body.trim().length < 10} className={`${btnDark} self-start disabled:opacity-50`}>
          {busy ? "Sending…" : "Send ticket"}
        </button>
      </form>
    </Panel>
  );
}

function Thread({ id, onChange }: { id: number; onChange: () => void }) {
  const [data, setData] = useState<{ ticket: Ticket; messages: Msg[] } | null>(null);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch(`/api/support/${id}`, { cache: "no-store" }).catch(() => null);
    const b = await r?.json().catch(() => ({}));
    if (!r?.ok) return setError(b?.error ?? "Couldn't open this ticket.");
    setData(b);
  }, [id]);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);
  const send = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    const r = await fetch(`/api/support/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
    const b = await r?.json().catch(() => ({}));
    setBusy(false);
    if (!r?.ok) return setError(b?.error ?? "Couldn't send.");
    setReply("");
    await load();
    onChange();
  };
  if (error && !data) return <Panel><p className="text-[13px] text-bad">{error}</p></Panel>;
  if (!data) return <Panel><p className="text-[13px] text-faint">Loading…</p></Panel>;
  const { ticket, messages } = data;
  return (
    <Panel>
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 flex-1 text-base font-semibold">{ticket.subject}</h2>
        <span className={chip}>{STATUS_LABEL[ticket.status]}</span>
        <span className="text-xs text-faint">#{ticket.id}</span>
      </header>
      <ol className="flex flex-col gap-3">
        {messages.map((m) => (
          <li key={m.id} className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] ${m.fromStaff ? "self-start border border-accent-line bg-accent-soft" : "self-end bg-hover"}`}>
            <div className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">{m.fromStaff ? "Wanlly team" : "You"} · {ago(m.createdAt)}</div>
            <p className="whitespace-pre-wrap">{m.body}</p>
          </li>
        ))}
      </ol>
      <form
        className="flex flex-col gap-2 border-t border-line pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send({ body: reply });
        }}
      >
        <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={4000} placeholder={ticket.status === "closed" ? "Write to reopen this ticket" : "Add a reply"} className={`${input} resize-y`} />
        {error && <p className="text-[13px] text-bad">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy || reply.trim().length < 2} className={`${btnDark} disabled:opacity-50`}>
            {busy ? "Sending…" : "Reply"}
          </button>
          {ticket.status !== "closed" && (
            <button type="button" disabled={busy} onClick={() => void send({ close: true })} className={btnGhost}>
              Mark solved
            </button>
          )}
        </div>
      </form>
    </Panel>
  );
}
