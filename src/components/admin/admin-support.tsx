"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Empty, Loading, Pills, api, btnDark, btnGhost, when } from "./admin-ui";

type Ticket = {
  id: number;
  userId: string;
  email: string | null;
  subject: string;
  category: string;
  status: "open" | "answered" | "closed";
  page: string | null;
  createdAt: string;
  updatedAt: string;
  messages: number;
  last: string | null;
};
type Msg = { id: number; fromStaff: boolean; body: string; createdAt: string };
type Show = "open" | "answered" | "closed" | "all";

const STATUS = { open: "Waiting on us", answered: "Replied", closed: "Closed" } as const;
const TONE = { open: "bg-accent-soft text-accent", answered: "bg-hover text-muted", closed: "bg-hover text-faint" } as const;

/** The support inbox: tickets on the left, the conversation and a reply box on the right. */
export function SupportTab({ onPerson }: { onPerson?: (who: string) => void }) {
  const [show, setShow] = useState<Show>("open");
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState("");
  const [pick, setPick] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const b = await api<{ tickets: Ticket[] }>(`/api/admin/support?show=${show}`);
      setTickets(b.tickets);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [show]);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <Card
        title="Support tickets"
        note="Raised from the Help page. Replies are emailed to the person."
        actions={
          <Pills
            label="Show"
            value={show}
            onChange={(v) => (setShow(v), setTickets(null))}
            options={[
              ["open", "Waiting"],
              ["answered", "Replied"],
              ["closed", "Closed"],
              ["all", "All"],
            ]}
          />
        }
      >
        {error ? (
          <Empty>{error}</Empty>
        ) : !tickets ? (
          <Loading />
        ) : !tickets.length ? (
          <Empty>{show === "open" ? "Nothing waiting. Nice." : "No tickets here."}</Empty>
        ) : (
          <ul className="-mx-2 flex flex-col">
            {tickets.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setPick(t.id)} className={`flex w-full flex-col gap-1 rounded-lg px-2 py-2 text-left hover:bg-hover ${pick === t.id ? "bg-hover" : ""}`}>
                  <span className="flex items-center gap-2">
                    <b className="min-w-0 flex-1 truncate text-[13px] font-semibold">{t.subject}</b>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE[t.status]}`}>{STATUS[t.status]}</span>
                  </span>
                  <span className="truncate text-xs text-muted">{t.last}</span>
                  <span className="text-[11px] text-faint">
                    #{t.id} · {t.category} · {t.email ?? t.userId} · {when(t.updatedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {pick ? <Conversation key={pick} id={pick} onChange={load} onPerson={onPerson} /> : <Card title="Conversation"><Empty>Pick a ticket.</Empty></Card>}
    </div>
  );
}

function Conversation({ id, onChange, onPerson }: { id: number; onChange: () => void; onPerson?: (who: string) => void }) {
  const [data, setData] = useState<{ ticket: Ticket; messages: Msg[] } | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const load = useCallback(async () => {
    try {
      setData(await api(`/api/admin/support/${id}`));
    } catch (e) {
      setNote((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);
  const send = async (payload: { body?: string; status?: string }) => {
    setBusy(true);
    setNote("");
    try {
      await api(`/api/admin/support/${id}`, "POST", payload);
      setReply("");
      await load();
      onChange();
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!data) return <Card title="Conversation">{note ? <Empty>{note}</Empty> : <Loading />}</Card>;
  const { ticket, messages } = data;
  return (
    <Card
      title={`#${ticket.id} ${ticket.subject}`}
      note={`${ticket.email ?? ticket.userId} · ${ticket.category}${ticket.page ? ` · from ${ticket.page}` : ""} · opened ${when(ticket.createdAt)}`}
      actions={
        <div className="flex flex-wrap gap-1.5">
          {onPerson && (
            <button type="button" className={btnGhost} onClick={() => onPerson(ticket.email ?? ticket.userId)}>
              Open person
            </button>
          )}
          <button type="button" className={btnGhost} disabled={busy} onClick={() => send({ status: ticket.status === "closed" ? "open" : "closed" })}>
            {ticket.status === "closed" ? "Reopen" : "Close"}
          </button>
        </div>
      }
    >
      <ol className="flex flex-col gap-3">
        {messages.map((m) => (
          <li key={m.id} className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] ${m.fromStaff ? "self-end border border-accent-line bg-accent-soft" : "self-start bg-hover"}`}>
            <div className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
              {m.fromStaff ? "Team" : "Them"} · {when(m.createdAt)}
            </div>
            <p className="whitespace-pre-wrap">{m.body}</p>
          </li>
        ))}
      </ol>
      <form
        className="mt-3 flex flex-col gap-2 border-t border-line pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send({ body: reply });
        }}
      >
        <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} maxLength={4000} placeholder="Reply (emailed to them)" className="w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 text-[13px] outline-none focus:border-faint" />
        {note && <p className="text-[13px] text-bad">{note}</p>}
        <div className="flex flex-wrap gap-1.5">
          <button type="submit" className={btnDark} disabled={busy || reply.trim().length < 2}>
            {busy ? "Sending…" : "Send reply"}
          </button>
          <button type="button" className={btnGhost} disabled={busy || reply.trim().length < 2} onClick={() => send({ body: reply, status: "closed" })}>
            Reply and close
          </button>
        </div>
      </form>
    </Card>
  );
}
