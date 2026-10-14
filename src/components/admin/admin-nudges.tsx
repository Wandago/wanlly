"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Chip, api, btnDark, btnGhost } from "./admin-ui";

type Due = { kind: "beta1" | "beta2" | "idle7" | "idle21"; email: string; subject: string; text: string; html: string };
type Data = { auto: boolean; mailReady: boolean; perRun: number; stats: { sent30: Record<string, number>; optouts: number }; due: Due[] };

const KIND: Record<Due["kind"], string> = {
  beta1: "Beta: approved, no account (1st)",
  beta2: "Beta: approved, no account (last)",
  idle7: "Quiet 7+ days",
  idle21: "Quiet 21+ days",
};

/** Admin → Beta: come-back emails (lib/nudges.ts). See who's due, read each email, send now or daily. */
export function ComeBackEmails() {
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    api<Data>("/api/admin/nudges")
      .then(setData)
      .catch((e: Error) => setNote(e.message));
  }, []);
  useEffect(() => {
    queueMicrotask(load);
  }, [load]);

  const flip = async () => {
    if (!data) return;
    const reason = window.prompt(data.auto ? "Stop sending come-back emails every day? Give a reason for the log." : "Send come-back emails automatically every day at 10:15 Nairobi time? Give a reason for the log.");
    if (!reason) return;
    try {
      await api("/api/admin/flags", "POST", { key: "nudgesAuto", on: !data.auto, reason });
      load();
    } catch (e) {
      setNote((e as Error).message);
    }
  };
  const send = async () => {
    if (!data || !window.confirm(`Send the next ${Math.min(data.perRun, data.due.length)} come-back emails now?`)) return;
    setBusy(true);
    try {
      const r = await api<{ sent: number; failed: number; error?: string }>("/api/admin/nudges", "POST");
      setNote(r.error ?? `✓ Sent ${r.sent}${r.failed ? `, ${r.failed} failed (they'll be retried)` : ""}.`);
      load();
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sent = data ? Object.values(data.stats.sent30).reduce((a, b) => a + b, 0) : 0;
  return (
    <Card
      title="Come-back emails"
      note="Approved applicants who never made an account get up to two reminders (mentioning what they said they'd build). People quiet for a week get up to two notes about the project or chat they last worked on: its name only, never what they wrote; sensitive topics are left out. One-click unsubscribe; turned off per person on their Profile."
      actions={
        data && (
          <span className="flex gap-2">
            <button type="button" className={btnGhost} onClick={send} disabled={busy || !data.due.length || !data.mailReady}>
              {busy ? "Sending…" : `Send ${Math.min(data.perRun, data.due.length)} now`}
            </button>
            <button type="button" className={data.auto ? btnGhost : btnDark} onClick={flip}>
              {data.auto ? "Stop daily sending" : "Send daily"}
            </button>
          </span>
        )
      }
    >
      {!data ? (
        <p className="text-[13px] text-muted">{note || "Loading…"}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="flex flex-wrap items-center gap-2 text-[13px]">
            <Chip s={data.auto ? "active" : "pending"} label={data.auto ? "Daily at 10:15 Nairobi" : "Manual"} />
            <span className="text-muted">
              {data.due.length} due now · {sent} sent in 30 days · {data.stats.optouts} unsubscribed
            </span>
            {!data.mailReady && <span className="text-bad">Email isn&apos;t set up: add SMTP_USER and SMTP_PASS in Cloudflare.</span>}
          </p>
          {note && <p className="text-[13px]">{note}</p>}
          {data.due.length > 0 && (
            <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
              {data.due.slice(0, 40).map((d, i) => (
                <li key={`${d.email}-${d.kind}`} className="flex flex-col gap-2 px-3 py-2.5">
                  <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex flex-wrap items-center gap-2 text-left text-[13px]">
                    <span className="rounded-full bg-hover px-2 py-0.5 text-[11px] text-muted">{KIND[d.kind]}</span>
                    <b className="font-medium">{d.subject}</b>
                    <span className="ml-auto text-faint">{d.email}</span>
                  </button>
                  {open === i && <iframe title={`Email to ${d.email}`} srcDoc={d.html} sandbox="" className="h-[460px] w-full rounded-lg border border-line bg-white" />}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
