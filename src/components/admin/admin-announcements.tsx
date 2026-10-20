"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Chip, api, btnDark, btnGhost, when } from "./admin-ui";

type Audience = "users" | "beta" | "all";
type Ann = { id: number; subject: string; heading: string; audience: Audience; status: "draft" | "sending" | "paused" | "sent"; sent: number; createdAt: string; finishedAt: string | null };
type Data = { announcements: Ann[]; counts: Record<Audience, number>; mailReady: boolean };

const AUD: Record<Audience, string> = { users: "Accounts", beta: "Approved beta applicants without an account", all: "Everyone" };
const field = "w-full rounded-lg border border-line bg-bg px-3 py-2 text-[13px] outline-none focus:border-fg";
const EMPTY = { subject: "", heading: "", body: "", buttonLabel: "Try it now", buttonUrl: "https://wanlly.africa/app", audience: "users" as Audience };

/** Admin → Beta: one email to everyone about a big launch (lib/announcements.ts). */
export function Announcements() {
  const [data, setData] = useState<Data | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [preview, setPreview] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    api<Data>("/api/admin/announcements")
      .then(setData)
      .catch((e: Error) => setNote(e.message));
  }, []);
  useEffect(() => {
    queueMicrotask(load);
  }, [load]);
  // The email as it'll look, refreshed a moment after typing stops.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!form.subject && !form.body) return setPreview("");
      api<{ html: string }>("/api/admin/announcements/preview", "POST", form)
        .then((r) => setPreview(r.html))
        .catch(() => {});
    }, 500);
    return () => window.clearTimeout(t);
  }, [form]);

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setNote("");
    try {
      const msg = await fn();
      if (msg) setNote(msg);
      load();
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    run(async () => {
      await api("/api/admin/announcements", "POST", form);
      setForm(EMPTY);
      return "✓ Saved as a draft below. Send yourself a test, then start sending.";
    });
  const act = (a: Ann, action: string) =>
    run(async () => {
      if (action === "start" && !window.confirm(`Send "${a.subject}" to ${data?.counts[a.audience] ?? "all"} people (${AUD[a.audience]})? It goes out ${40} at a time, every hour.`)) return;
      const r = await api<{ note?: string; sent?: number; left?: number; error?: string }>(`/api/admin/announcements/${a.id}`, "POST", { action });
      return r.error ?? r.note ?? (r.sent !== undefined ? `✓ Sent ${r.sent}${r.left ? `; more to go (next batch within the hour)` : "; that's everyone"}.` : "✓ Done.");
    });

  return (
    <Card title="Announcements" note="One email about a big launch or important update. Goes to accounts that haven't turned off Product news and/or approved beta applicants who haven't made an account yet; never to anyone who unsubscribed. Sent 40 at a time, every hour, once per person.">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2.5">
          <input className={field} placeholder="Subject, e.g. New: publish your app to the web in one click" value={form.subject} onChange={(e) => set("subject", e.target.value)} maxLength={140} />
          <input className={field} placeholder="Heading in the email (optional, defaults to the subject)" value={form.heading} onChange={(e) => set("heading", e.target.value)} maxLength={140} />
          <textarea
            className={`${field} min-h-[180px]`}
            placeholder={"What's new, in a few short paragraphs.\n\nLeave a blank line between paragraphs. **Bold** works."}
            value={form.body}
            onChange={(e) => set("body", e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <input className={field} placeholder="Button text" value={form.buttonLabel} onChange={(e) => set("buttonLabel", e.target.value)} maxLength={40} />
            <input className={field} placeholder="https://wanlly.africa/…" value={form.buttonUrl} onChange={(e) => set("buttonUrl", e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-1.5 text-[13px]">
            {(Object.keys(AUD) as Audience[]).map((k) => (
              <button key={k} type="button" aria-pressed={form.audience === k} onClick={() => set("audience", k)} className={`rounded-full border px-3 py-1 ${form.audience === k ? "border-accent-line bg-accent-soft text-accent" : "border-line text-muted"}`}>
                {AUD[k]} {data ? `· ${data.counts[k]}` : ""}
              </button>
            ))}
          </div>
          <button type="button" className={`${btnDark} self-start`} disabled={busy || form.subject.length < 4 || form.body.length < 20} onClick={save}>
            Save draft
          </button>
          {note && <p className={`text-[13px] ${note.startsWith("✓") ? "text-good" : "text-bad"}`}>{note}</p>}
          {data && !data.mailReady && <p className="text-[13px] text-bad">Email isn&apos;t set up: add SMTP_USER and SMTP_PASS in Cloudflare.</p>}
        </div>
        <div className="min-h-[300px] overflow-hidden rounded-xl border border-line bg-white">
          {preview ? <iframe title="Announcement preview" srcDoc={preview} sandbox="" className="h-[520px] w-full" /> : <p className="p-4 text-[13px] text-neutral-500">The email preview appears here as you write.</p>}
        </div>
      </div>
      {data && data.announcements.length > 0 && (
        <ul className="mt-2 flex flex-col divide-y divide-line rounded-xl border border-line">
          {data.announcements.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-[13px]">
              <Chip s={a.status === "sent" ? "handled" : a.status === "sending" ? "active" : "pending"} label={a.status} />
              <b className="font-medium">{a.subject}</b>
              <span className="text-muted">
                {AUD[a.audience]} · {a.sent} sent · {when(a.createdAt)}
              </span>
              <span className="ml-auto flex flex-wrap gap-1.5">
                {a.status !== "sent" && (
                  <button type="button" className={btnGhost} disabled={busy} onClick={() => act(a, "test")}>
                    Send me a test
                  </button>
                )}
                {(a.status === "draft" || a.status === "paused") && (
                  <button type="button" className={btnDark} disabled={busy} onClick={() => act(a, "start")}>
                    {a.status === "paused" ? "Resume" : "Start sending"}
                  </button>
                )}
                {a.status === "sending" && (
                  <>
                    <button type="button" className={btnGhost} disabled={busy} onClick={() => act(a, "batch")}>
                      Send next batch now
                    </button>
                    <button type="button" className={btnGhost} disabled={busy} onClick={() => act(a, "pause")}>
                      Pause
                    </button>
                  </>
                )}
                {a.status === "draft" && (
                  <button type="button" className={btnGhost} disabled={busy} onClick={() => act(a, "delete")}>
                    Delete
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
