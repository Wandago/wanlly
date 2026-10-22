"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { AbuseTab, AdsTab, TrafficTab } from "./admin-insights";
import { AdvertisersTab } from "./admin-advertisers";
import { SupportTab } from "./admin-support";
import { ComeBackEmails } from "./admin-nudges";
import { Announcements } from "./admin-announcements";
import { LearnTab } from "./admin-learn";
import { ApiError, Card, Chip, Empty, Kpi, Pills, api, btnDark, btnGhost, num, usd, when, Loading } from "./admin-ui";
import type { FirstTouch } from "@/lib/first-touch";
import { inviteMessage } from "@/lib/beta-invite";

/* The real admin page. Every list and action goes through /api/admin, which checks the role. */

type Tab = "overview" | "traffic" | "ads" | "advertisers" | "abuse" | "users" | "beta" | "learn" | "messages" | "support";
type Totals = Record<"users" | "newToday" | "activeToday" | "videosToday" | "earnedToday" | "spentToday" | "betaPending" | "betaTotal" | "messagesOpen" | "paused" | "visitorsToday" | "viewsToday" | "adViewsToday" | "revenueToday" | "costToday", number>;
type Day = { day: string; signups: number; active: number; videos: number; spent: number; applications: number };
type Application = { id: number; name: string; email: string; country: string | null; build: string; source: string | null; referralCode: string | null; inviteCode: string; networkCountry: string | null; status: "pending" | "approved" | "declined"; createdAt: string; channel?: string | null; firstTouch?: FirstTouch | null };
type Message = { id: number; name: string; email: string; topic: string; message: string; networkCountry: string | null; handledAt: string | null; createdAt: string; autoReply: string | null; reply: string | null; repliedAt: string | null };
type Access = { unlimited: boolean; dayLimit: number | null; weekLimit: number | null; free: boolean; expiresAt: string; note: string | null };
type User = { id: string; email: string | null; name: string | null; country: string | null; role: string; status: string; createdAt: string; credits: number; spentToday: number; lastActive: string | null; access: Access | null };

/** Hook for a list that reloads when its query changes and can be patched locally after an action. */
function useList<T>(url: string, key: string) {
  const [items, setItems] = useState<T[] | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    api<Record<string, unknown>>(url)
      .then((d) => {
        if (!live) return;
        setItems(d[key] as T[]);
        setExtra(d);
        setError("");
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [url, key]);
  return { items, setItems, extra, error };
}

type Check = { provider: string; model: string; ok: boolean; detail: string; ms: number };

/** Sends one tiny real request to each model provider and shows exactly what came back. */
function AiCheck() {
  const [results, setResults] = useState<Check[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async () => {
    setBusy(true);
    setError("");
    try {
      setResults((await api<{ results: Check[] }>("/api/admin/ai-check", "POST")).results);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card
      title="AI connection"
      note="A one-word test request to each provider. Costs a fraction of a cent on paid keys."
      actions={
        <button type="button" className={btnGhost} onClick={run} disabled={busy}>
          {busy ? "Checking…" : "Check now"}
        </button>
      }
    >
      {error && <p className="text-[13px] text-bad">{error}</p>}
      {results && (
        <ul className="flex flex-col">
          {results.map((r) => (
            <li key={r.provider} className="flex flex-wrap items-start gap-x-3 gap-y-1 border-t border-line py-2.5 text-[13px] first:border-t-0 first:pt-0">
              <Chip s={r.ok ? "active" : "frozen"} label={r.ok ? "Working" : "Failing"} />
              <b className="font-medium capitalize">{r.provider}</b>
              {r.model && <code className="font-mono text-xs text-muted">{r.model}</code>}
              <span className="ml-auto font-mono text-xs text-faint">{r.ms ? `${(r.ms / 1000).toFixed(1)}s` : ""}</span>
              <span className={`basis-full break-words ${r.ok ? "text-muted" : "text-bad"}`}>{r.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Which migrations in drizzle/ have run on the live database. */
function DbCheck() {
  const [rows, setRows] = useState<{ file: string; applied: boolean }[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ migrations: { file: string; applied: boolean }[] }>("/api/admin/db-check")
      .then((d) => setRows(d.migrations))
      .catch((e: Error) => setError(e.message));
  }, []);
  const missing = rows?.filter((r) => !r.applied) ?? [];
  return (
    <Card title="Database" note="Each file in drizzle/ adds a table or column. Run a missing one in Neon's SQL editor, oldest first.">
      {error && <p className="text-[13px] text-bad">{error}</p>}
      {rows && (
        <p className="flex flex-wrap items-center gap-2 text-[13px]">
          <Chip s={missing.length ? "frozen" : "active"} label={missing.length ? `${missing.length} missing` : "Up to date"} />
          {missing.length ? missing.map((r) => <code key={r.file} className="font-mono text-xs text-bad">{r.file}</code>) : <span className="text-muted">All {rows.length} migrations have run.</span>}
        </p>
      )}
    </Card>
  );
}

function Overview({ go }: { go: (t: Tab) => void }) {
  const [data, setData] = useState<{ totals: Totals; days: Day[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ totals: Totals; days: Day[] }>("/api/admin/overview")
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);
  if (error) return <Empty>{error}</Empty>;
  if (!data) return <Loading />;
  const t = data.totals;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <button type="button" onClick={() => go("traffic")} className="text-left">
          <Kpi label="Visitors today" value={t.visitorsToday} sub={`${num(t.viewsToday)} page views →`} />
        </button>
        <button type="button" onClick={() => go("ads")} className="text-left">
          <Kpi label="Ad views today" value={t.adViewsToday} sub="seen for 1s or more →" />
        </button>
        <button type="button" onClick={() => go("ads")} className="text-left">
          <Kpi label="Revenue today" value={usd(t.revenueToday)} sub="real: campaigns, Adsterra, recorded →" />
        </button>
        <Kpi label="AI cost today" value={usd(t.costToday)} sub={t.revenueToday >= t.costToday ? "covered by ads" : "more than ads bring in"} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="People" value={t.users} sub={`${num(t.newToday)} new today`} />
        <Kpi label="Active today" value={t.activeToday} sub="earned or spent a credit" />
        <Kpi label="Videos today" value={t.videosToday} sub={`${num(t.earnedToday)} credits earned`} />
        <Kpi label="Credits used today" value={t.spentToday} sub="on models" />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <button type="button" onClick={() => go("beta")} className="text-left">
          <Kpi label="Beta waiting" value={t.betaPending} sub={`of ${num(t.betaTotal)} applications · review →`} />
        </button>
        <button type="button" onClick={() => go("messages")} className="text-left">
          <Kpi label="Messages open" value={t.messagesOpen} sub="read and reply →" />
        </button>
        <button type="button" onClick={() => go("abuse")} className="text-left">
          <Kpi label="Paused accounts" value={t.paused} sub="frozen or banned · abuse →" />
        </button>
      </div>
      <Card title="Last 14 days" note="UTC days. Active means the person earned or spent at least one credit.">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-muted">
                {["Day", "Sign-ups", "Active", "Videos", "Credits used", "Beta applications"].map((h, i) => (
                  <th key={h} className={`border-b border-line px-2 py-2 font-medium whitespace-nowrap ${i ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.days.map((d) => (
                <tr key={d.day} className="hover:bg-hover/60">
                  <td className="border-b border-line px-2 py-1.5 whitespace-nowrap">{new Date(`${d.day}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}</td>
                  {[d.signups, d.active, d.videos, d.spent, d.applications].map((v, i) => (
                    <td key={i} className={`border-b border-line px-2 py-1.5 text-right font-mono tabular-nums ${v ? "" : "text-faint"}`}>
                      {num(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <DbCheck />
      <AiCheck />
      <p className="text-xs text-faint">
        Ad revenue, networks and per-country margins appear once a real ad network reports them.{" "}
        <Link href="/admin/preview" className="underline underline-offset-2 hover:text-fg">
          See the design with sample data
        </Link>
      </p>
    </div>
  );
}

/** Detected channel plus the detail behind it: campaign, referring site and first page. */
function cameFrom(a: Application) {
  const t = a.firstTouch;
  const extra = [t?.campaign && `campaign ${t.campaign}`, t?.medium, t?.referrer && t.referrer !== t.source && t.referrer, t?.landing && `landed on ${t.landing}`].filter(Boolean);
  return `${a.channel}${extra.length ? ` (${extra.join(", ")})` : ""}`;
}

function inviteMail(a: Application) {
  const { subject, text } = inviteMessage(a, window.location.origin);
  return `mailto:${encodeURIComponent(a.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

function Beta() {
  const [status, setStatus] = useState<"pending" | "approved" | "declined" | "all">("pending");
  const { items, setItems, extra, error } = useList<Application>(`/api/admin/beta${status === "all" ? "" : `?status=${status}`}`, "applications");
  const [busy, setBusy] = useState<number | null>(null);
  const [open, setOpen] = useState<boolean | null>(null);
  const isOpen = open ?? extra.signupOpen === true;
  const flipOpen = async () => {
    const reason = window.prompt(isOpen ? "Close sign-up again, so only approved applicants get in? Give a reason for the log." : "Open Wanlly to everyone who signs up, ending the private beta? Give a reason for the log.");
    if (!reason?.trim()) return;
    try {
      await api("/api/admin/flags", "POST", { key: "signupOpen", on: !isOpen, reason });
      setOpen(!isOpen);
    } catch (e) {
      setNote((e as Error).message);
    }
  };
  const [note, setNote] = useState("");
  const [autoState, setAuto] = useState<boolean | null>(null);
  const isAuto = autoState ?? extra.betaAutoApprove === true;
  const flipAuto = async () => {
    const reason = window.prompt(isAuto ? "Go back to approving applications by hand? Give a reason for the log." : "Approve every new application instantly and email the invite at once? Give a reason for the log.");
    if (!reason?.trim()) return;
    try {
      await api("/api/admin/flags", "POST", { key: "betaAutoApprove", on: !isAuto, reason });
      setAuto(!isAuto);
    } catch (e) {
      setNote((e as Error).message);
    }
  };

  const mailOn = extra.mailReady === true;
  const decide = async (a: Application, next: Application["status"]) => {
    setBusy(a.id);
    setNote("");
    try {
      const { application, invite } = await api<{ application: Application; invite?: "sent" | "failed" | "skipped" }>(`/api/admin/beta/${a.id}`, "PATCH", { status: next });
      setItems((xs) => (xs ?? []).map((x) => (x.id === a.id ? application : x)));
      if (invite === "sent") setNote(`✓ Approved, and the invite was emailed to ${a.email}.`);
      if (invite === "failed") setNote(`Approved, but the invite email couldn't be sent. Press "Send invite" to try again.`);
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const resend = async (a: Application) => {
    setBusy(a.id);
    setNote("");
    try {
      await api(`/api/admin/beta/${a.id}`, "POST", {});
      setNote(`✓ Invite emailed to ${a.email}.`);
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Who can use Wanlly"
        note={isOpen ? "Open to everyone: anyone who signs up can use it." : "Private beta: staff, accounts made before the beta gate, and people whose application is approved here. Everyone else sees that they're on the list. They sign up with the email they applied with."}
        actions={
          <button type="button" className={isOpen ? btnGhost : btnDark} onClick={flipOpen}>
            {isOpen ? "Back to private beta" : "Open to everyone"}
          </button>
        }
      >
        <p className="flex items-center gap-2 text-[13px]">
          <Chip s={isOpen ? "active" : "pending"} label={isOpen ? "Open sign-up" : "Private beta"} />
        </p>
      </Card>
      {!isOpen && (
        <Card
          title="Instant approval"
          note={isAuto ? "Every new application is approved on the spot and the invite goes out at once. The page tells them to create their account." : "Applications wait here until someone approves them. Turn this on to let people straight in while the beta stays invite-only on paper."}
          actions={
            <button type="button" className={isAuto ? btnGhost : btnDark} onClick={flipAuto}>
              {isAuto ? "Approve by hand" : "Approve instantly"}
            </button>
          }
        >
          <p className="flex items-center gap-2 text-[13px]">
            <Chip s={isAuto ? "active" : "pending"} label={isAuto ? "Instant" : "By hand"} />
          </p>
        </Card>
      )}
      <ComeBackEmails />
      <Announcements />
      <Card
        title="Beta applications"
        note={mailOn ? "Approving lets that email in straight away and emails them the invite from Wanlly's mailbox. Decisions are logged." : "Approving lets that email in straight away. Then send the invite from your own email (or add SMTP_USER and SMTP_PASS in Cloudflare to send it automatically). Decisions are logged."}
        actions={
          <Pills
            label="Show"
            value={status}
            onChange={setStatus}
            options={[
              ["pending", "Waiting"],
              ["approved", "Approved"],
              ["declined", "Declined"],
              ["all", "All"],
            ]}
          />
        }
      >
        {extra.mailReady === false && (
          <p className="rounded-lg border border-line bg-hover px-3 py-2 text-[13px] text-muted">
            Invites aren&apos;t sent automatically yet: add {Array.isArray(extra.mailMissing) && extra.mailMissing.length ? (extra.mailMissing as string[]).join(" and ") : "SMTP_USER and SMTP_PASS"} in Cloudflare (wanlly → Settings → Variables and Secrets), then Deploy. Until then, Email invite opens your own email app.
          </p>
        )}
        {note && <p className={`text-[13px] ${note.startsWith("✓") ? "text-good" : "text-bad"}`}>{note}</p>}
        {error ? (
          <Empty>{error}</Empty>
        ) : !items ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty>Nothing here.</Empty>
        ) : (
          <ul className="flex flex-col">
            {items.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start gap-3 border-t border-line py-3 first:border-t-0 first:pt-0">
                <div className="min-w-0 flex-1 basis-[320px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="font-semibold">{a.name}</b>
                    <span className="text-[13px] text-muted">{a.email}</span>
                    <Chip s={a.status} />
                  </div>
                  <p className="mt-1 text-[13px] whitespace-pre-wrap">{a.build}</p>
                  <small className="mt-1 block text-xs text-faint">
                    {[a.country && `Says ${a.country}`, a.networkCountry && `network ${a.networkCountry}`, a.source && `says heard via ${a.source}`, a.channel && `came from ${cameFrom(a)}`, a.referralCode && `referred by ${a.referralCode}`, `applied ${when(a.createdAt)}`, `code ${a.inviteCode}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {a.status === "approved" &&
                    (mailOn ? (
                      <button type="button" className={btnDark} disabled={busy === a.id} onClick={() => resend(a)}>
                        Send invite
                      </button>
                    ) : (
                      <a href={inviteMail(a)} className={btnDark}>
                        Email invite
                      </a>
                    ))}
                  {a.status !== "approved" && (
                    <button type="button" className={btnDark} disabled={busy === a.id} onClick={() => decide(a, "approved")}>
                      Approve
                    </button>
                  )}
                  {a.status !== "declined" && (
                    <button type="button" className={btnGhost} disabled={busy === a.id} onClick={() => decide(a, "declined")}>
                      Decline
                    </button>
                  )}
                  {a.status !== "pending" && (
                    <button type="button" className={btnGhost} disabled={busy === a.id} onClick={() => decide(a, "pending")}>
                      Undo
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Messages() {
  const [show, setShow] = useState<"open" | "handled" | "all">("open");
  const { items, setItems, extra, error } = useList<Message>(`/api/admin/messages?show=${show}`, "messages");
  const [note, setNote] = useState("");
  const [autoState, setAuto] = useState<boolean | null>(null);
  const isAuto = autoState ?? extra.autoReply === true;
  // The reply being written, per message, and which one is drafting with AI.
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const flipAuto = async () => {
    const reason = window.prompt(isAuto ? "Stop instant replies to questions? Give a reason for the log." : "Reply to every question instantly (with an AI answer from Wanlly's facts where it can)? Give a reason for the log.");
    if (!reason) return;
    try {
      await api("/api/admin/flags", "POST", { key: "autoReply", on: !isAuto, reason });
      setAuto(!isAuto);
    } catch (e) {
      setNote((e as Error).message);
    }
  };
  const draft = async (m: Message) => {
    setBusy(m.id);
    try {
      const { draft } = await api<{ draft: string }>(`/api/admin/messages/${m.id}/draft`, "POST");
      setDrafts((d) => ({ ...d, [m.id]: draft }));
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const send = async (m: Message) => {
    const text = drafts[m.id]?.trim();
    if (!text) return;
    setBusy(m.id);
    try {
      await api(`/api/admin/messages/${m.id}/reply`, "POST", { text });
      setItems((xs) => (xs ?? []).map((x) => (x.id === m.id ? { ...x, reply: text, repliedAt: new Date().toISOString(), handledAt: x.handledAt ?? new Date().toISOString() } : x)));
      setDrafts((d) => ({ ...d, [m.id]: "" }));
      setNote(`✓ Reply sent to ${m.email}.`);
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const mark = async (m: Message, handled: boolean) => {
    setNote("");
    try {
      const { message } = await api<{ message: Message }>(`/api/admin/messages/${m.id}`, "PATCH", { handled });
      setItems((xs) => (xs ?? []).map((x) => (x.id === m.id ? message : x)));
    } catch (e) {
      setNote((e as Error).message);
    }
  };
  const reply = (m: Message) =>
    `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(`Re: your message to Wanlly (${m.topic})`)}&body=${encodeURIComponent(`Hi ${m.name.split(" ")[0]},\n\n\n\n> ${m.message.replace(/\n/g, "\n> ")}`)}`;

  return (
    <Card
      title="Messages"
      note={isAuto ? "From the contact page. Instant replies are on: each sender gets a thank-you, with a short answer from Wanlly's facts where it can (shown under the message). Reply here to follow up." : "From the contact page. Reply here (it goes from Wanlly's mailbox), or turn on instant replies."}
      actions={
        <span className="flex flex-wrap items-center gap-2">
        <button type="button" className={isAuto ? btnGhost : btnDark} onClick={flipAuto}>
          {isAuto ? "Stop instant replies" : "Reply instantly"}
        </button>
        <Pills
          label="Show"
          value={show}
          onChange={setShow}
          options={[
            ["open", "Open"],
            ["handled", "Handled"],
            ["all", "All"],
          ]}
        />
        </span>
      }
    >
      {note && <p className={`text-[13px] ${note.startsWith("✓") ? "text-good" : "text-bad"}`}>{note}</p>}
      {error ? (
        <Empty>{error}</Empty>
      ) : !items ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty>No messages here.</Empty>
      ) : (
        <ul className="flex flex-col">
          {items.map((m) => (
            <li key={m.id} className="flex flex-wrap items-start gap-3 border-t border-line py-3 first:border-t-0 first:pt-0">
              <div className="min-w-0 flex-1 basis-[320px]">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="font-semibold">{m.name}</b>
                  <span className="text-[13px] text-muted">{m.email}</span>
                  <span className="rounded-full bg-hover px-2 py-0.5 text-xs text-muted">{m.topic}</span>
                  {m.handledAt && <Chip s="handled" />}
                </div>
                <p className="mt-1 text-[13px] whitespace-pre-wrap">{m.message}</p>
                <small className="mt-1 block text-xs text-faint">
                  {when(m.createdAt)}
                  {m.networkCountry && ` · network ${m.networkCountry}`}
                </small>
                {m.autoReply && (
                  <details className="mt-2 rounded-lg bg-hover px-3 py-2 text-[13px]">
                    <summary className="cursor-pointer text-muted">Instant reply sent</summary>
                    <p className="mt-1 whitespace-pre-wrap">{m.autoReply}</p>
                  </details>
                )}
                {m.reply && (
                  <details className="mt-2 rounded-lg border border-line px-3 py-2 text-[13px]">
                    <summary className="cursor-pointer text-muted">You replied {m.repliedAt ? when(m.repliedAt) : ""}</summary>
                    <p className="mt-1 whitespace-pre-wrap">{m.reply}</p>
                  </details>
                )}
                {drafts[m.id] !== undefined && (
                  <div className="mt-2 flex flex-col gap-2">
                    <textarea
                      className="min-h-[140px] w-full rounded-lg border border-line bg-bg px-3 py-2 text-[13px] outline-none focus:border-fg"
                      value={drafts[m.id]}
                      onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
                      placeholder={`Hi ${m.name.split(" ")[0]},`}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" className={btnDark} disabled={busy === m.id || !drafts[m.id]?.trim()} onClick={() => send(m)}>
                        {busy === m.id ? "Working…" : "Send reply"}
                      </button>
                      <button type="button" className={btnGhost} disabled={busy === m.id} onClick={() => draft(m)}>
                        Draft with AI
                      </button>
                      <a href={reply(m)} className={btnGhost}>
                        Use my email app
                      </a>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {drafts[m.id] === undefined && (
                  <button type="button" className={btnDark} onClick={() => setDrafts((d) => ({ ...d, [m.id]: `Hi ${m.name.split(" ")[0]},\n\n` }))}>
                    Reply
                  </button>
                )}
                <button type="button" className={btnGhost} onClick={() => mark(m, !m.handledAt)}>
                  {m.handledAt ? "Reopen" : "Mark handled"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Adds or removes one person's credits: amount, a reason they'll see, and an optional email. */
function GrantCredits({ user, onDone, onClose }: { user: User; onDone: (credits: number, message: string) => void; onClose: () => void }) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [amount, setAmount] = useState("50");
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const n = Math.floor(Number(amount));
  const submit = async () => {
    if (!(n > 0) || !reason.trim()) return setError("Enter an amount and a reason.");
    setBusy(true);
    setError("");
    try {
      const r = await api<{ delta?: number; credits: number; emailed?: boolean; duplicate?: boolean }>(`/api/admin/users/${encodeURIComponent(user.id)}/credits`, "POST", {
        amount: mode === "add" ? n : -n,
        reason: reason.trim(),
        notify: mode === "add" && notify,
        requestId,
      });
      const who = user.email ?? user.name ?? "them";
      const d = r.delta ?? 0;
      onDone(r.credits, r.duplicate ? "That was already done." : `${d > 0 ? `Added ${d} credits to` : `Removed ${-d} credits from`} ${who}. New balance ${num(r.credits)}.${r.emailed ? " They've been emailed." : ""}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-xl bg-code p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Pills<"add" | "remove"> label="Add or remove" value={mode} onChange={setMode} options={[["add", "Add"], ["remove", "Remove"]]} />
      <label className="flex flex-col gap-1 text-xs text-muted">
        Credits
        <input type="number" min={1} max={5000} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-24 rounded-lg border border-line bg-surface px-2 py-1 text-[13px] text-fg" />
      </label>
      <div className="flex gap-1">
        {[20, 50, 100, 250].map((v) => (
          <button key={v} type="button" className={btnGhost} onClick={() => setAmount(String(v))}>
            {v}
          </button>
        ))}
      </div>
      <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs text-muted">
        Reason (they see this in their credit history{mode === "add" && notify ? " and the email" : ""})
        <input
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
          placeholder={mode === "add" ? "Thanks for reporting a bug" : "Credits from a reversed survey"}
          className="rounded-lg border border-line bg-surface px-2 py-1 text-[13px] text-fg"
        />
      </label>
      {mode === "add" && (
        <label className="flex items-center gap-1.5 pb-1 text-xs text-muted">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Email them
        </label>
      )}
      <button type="submit" disabled={busy} className={btnDark}>
        {busy ? "Saving…" : `${mode === "add" ? "Add" : "Remove"} ${n > 0 ? `${n} ` : ""}credits`}
      </button>
      <button type="button" className={btnGhost} onClick={onClose}>
        Cancel
      </button>
      {error && <p className="w-full text-[13px] text-bad">{error}</p>}
    </form>
  );
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
function accessLabel(a: Access | null) {
  if (!a) return "Standard";
  const limits = a.unlimited ? "Unlimited" : `${a.dayLimit ?? "std"} / session · ${a.weekLimit ?? "std"} / week`;
  return `${limits}${a.free ? " · free" : ""} · to ${shortDate(a.expiresAt)}`;
}

/** Extra usage for one person until a date: no limits or their own, optionally free. */
function GrantAccess({ user, onDone, onClose }: { user: User; onDone: (access: Access | null, message: string) => void; onClose: () => void }) {
  const a = user.access;
  const [mode, setMode] = useState<"unlimited" | "custom">(a && !a.unlimited ? "custom" : "unlimited");
  const [dayLimit, setDayLimit] = useState(String(a?.dayLimit ?? 300));
  const [weekLimit, setWeekLimit] = useState(String(a?.weekLimit ?? 3000));
  const [days, setDays] = useState("30");
  const [free, setFree] = useState(a?.free ?? true);
  const [note, setNote] = useState(a?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const who = user.email ?? user.name ?? "them";
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ access: Access }>(`/api/admin/users/${encodeURIComponent(user.id)}/access`, "PUT", { mode, dayLimit, weekLimit, days: Number(days), free, note: note.trim() });
      onDone(r.access, `${who}: ${accessLabel(r.access)}.`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  const clear = async () => {
    setBusy(true);
    try {
      await api(`/api/admin/users/${encodeURIComponent(user.id)}/access`, "DELETE");
      onDone(null, `${who} is back on standard limits.`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  const input = "rounded-lg border border-line bg-surface px-2 py-1 text-[13px] text-fg";
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-xl bg-code p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Pills<"unlimited" | "custom"> label="Usage" value={mode} onChange={setMode} options={[["unlimited", "Unlimited"], ["custom", "Higher limits"]]} />
      {mode === "custom" && (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Per 6-hour session
            <input type="number" min={1} value={dayLimit} onChange={(e) => setDayLimit(e.target.value)} placeholder="100" className={`w-24 ${input}`} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Per week
            <input type="number" min={1} value={weekLimit} onChange={(e) => setWeekLimit(e.target.value)} placeholder="500" className={`w-24 ${input}`} />
          </label>
        </>
      )}
      <label className="flex flex-col gap-1 text-xs text-muted">
        For
        <select value={days} onChange={(e) => setDays(e.target.value)} className={input}>
          {[["7", "1 week"], ["14", "2 weeks"], ["30", "1 month"], ["90", "3 months"], ["365", "1 year"]].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 pb-1 text-xs text-muted" title="Replies are still recorded, but their credits are topped up as they go, so they never run out.">
        <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} /> Free (never runs out of credits)
      </label>
      <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs text-muted">
        Reason (for the log)
        <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Beta tester" className={input} />
      </label>
      <button type="submit" disabled={busy} className={btnDark}>
        {busy ? "Saving…" : "Save"}
      </button>
      {a && (
        <button type="button" disabled={busy} className={btnGhost} onClick={() => void clear()}>
          Back to standard
        </button>
      )}
      <button type="button" className={btnGhost} onClick={onClose}>
        Cancel
      </button>
      <p className="w-full text-xs text-faint">Standard is 100 credits a session and 500 a week (1,500 verified). Ends by itself on the date; they see it on their usage meters.</p>
      {error && <p className="w-full text-[13px] text-bad">{error}</p>}
    </form>
  );
}

function Users({ initial = "" }: { initial?: string }) {
  const [term, setTerm] = useState(initial);
  const [query, setQuery] = useState(initial);
  const { items, setItems, extra, error } = useList<User>(`/api/admin/users${query ? `?q=${encodeURIComponent(query)}` : ""}`, "users");
  const [note, setNote] = useState("");
  const [done, setDone] = useState("");
  const [granting, setGranting] = useState<string | null>(null);
  const [editingAccess, setEditingAccess] = useState<string | null>(null);
  const canEdit = extra.canEdit === true;
  const canGrant = extra.canGrant === true;

  const setStatus = async (u: User, status: string) => {
    if (status === u.status) return;
    const reason = window.prompt(`Why change ${u.email ?? u.id} to "${status}"? This goes in the log.`);
    if (!reason?.trim()) return;
    setNote("");
    try {
      await api(`/api/admin/users/${encodeURIComponent(u.id)}`, "PATCH", { status, reason });
      setItems((xs) => (xs ?? []).map((x) => (x.id === u.id ? { ...x, status } : x)));
    } catch (e) {
      setNote((e as Error).message);
    }
  };

  return (
    <Card
      title="People"
      note="Frozen and banned accounts can't earn or spend credits. Use ± next to a balance to add or remove credits, and Change under Usage for unlimited or higher limits. Every change needs a reason and is logged."
      actions={
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(term.trim());
          }}
        >
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search email or name"
            aria-label="Search people"
            className="w-48 rounded-lg border border-line bg-surface px-2.5 py-1 text-[13px] outline-none focus:border-faint"
          />
          <button type="submit" className={btnGhost}>
            Search
          </button>
        </form>
      }
    >
      {note && <p className="text-[13px] text-bad">{note}</p>}
      {done && <p className="text-[13px] text-good">{done}</p>}
      {error ? (
        <Empty>{error}</Empty>
      ) : !items ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty>No one matches.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-muted">
                {["Person", "Country", "Joined", "Last active", "Credits", "Used today", "Usage", "Status"].map((h, i) => (
                  <th key={h} className={`border-b border-line px-2 py-2 font-medium whitespace-nowrap ${i === 4 || i === 5 ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <Fragment key={u.id}>
                <tr className="hover:bg-hover/60">
                  <td className="border-b border-line px-2 py-1.5">
                    <span className="block max-w-[260px] truncate font-medium">{u.name ?? "–"}</span>
                    <small className="block max-w-[260px] truncate text-xs text-muted">
                      {u.email ?? u.id}
                      {u.role !== "user" && ` · ${u.role}`}
                    </small>
                  </td>
                  <td className="border-b border-line px-2 py-1.5">{u.country ?? "–"}</td>
                  <td className="border-b border-line px-2 py-1.5 whitespace-nowrap text-muted">{new Date(u.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td>
                  <td className="border-b border-line px-2 py-1.5 whitespace-nowrap text-muted">{u.lastActive ? when(u.lastActive) : "–"}</td>
                  <td className="border-b border-line px-2 py-1.5 text-right font-mono whitespace-nowrap tabular-nums">
                    {num(u.credits)}
                    {canGrant && u.status !== "deleted" && (
                      <button
                        type="button"
                        aria-label={`Add or remove credits for ${u.email ?? u.id}`}
                        aria-expanded={granting === u.id}
                        onClick={() => {
                          setDone("");
                          setEditingAccess(null);
                          setGranting((g) => (g === u.id ? null : u.id));
                        }}
                        className="ml-1.5 rounded-md border border-line px-1.5 font-sans text-xs text-muted hover:border-faint hover:text-fg"
                      >
                        ±
                      </button>
                    )}
                  </td>
                  <td className="border-b border-line px-2 py-1.5 text-right font-mono tabular-nums">{num(u.spentToday)}</td>
                  <td className="border-b border-line px-2 py-1.5 whitespace-nowrap">
                    <span className={`text-xs ${u.access ? "font-medium text-fg" : "text-muted"}`} title={u.access?.note ?? undefined}>
                      {accessLabel(u.access)}
                    </span>
                    {canGrant && u.status !== "deleted" && (
                      <button
                        type="button"
                        aria-expanded={editingAccess === u.id}
                        onClick={() => {
                          setDone("");
                          setGranting(null);
                          setEditingAccess((g) => (g === u.id ? null : u.id));
                        }}
                        className="ml-1.5 rounded-md border border-line px-1.5 text-xs text-muted hover:border-faint hover:text-fg"
                      >
                        Change
                      </button>
                    )}
                  </td>
                  <td className="border-b border-line px-2 py-1.5">
                    {canEdit && u.id !== extra.me && u.role !== "owner" && u.status !== "deleted" ? (
                      <select
                        value={u.status}
                        onChange={(e) => setStatus(u, e.target.value)}
                        aria-label={`Status for ${u.email ?? u.id}`}
                        className="rounded-lg border border-line bg-surface px-2 py-0.5 text-xs"
                      >
                        {["active", "slowed", "frozen", "banned"].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Chip s={u.status} />
                    )}
                  </td>
                </tr>
                {granting === u.id && (
                  <tr>
                    <td colSpan={8} className="border-b border-line px-2 py-2">
                      <GrantCredits
                        user={u}
                        onClose={() => setGranting(null)}
                        onDone={(credits, message) => {
                          setItems((xs) => (xs ?? []).map((x) => (x.id === u.id ? { ...x, credits } : x)));
                          setGranting(null);
                          setDone(message);
                        }}
                      />
                    </td>
                  </tr>
                )}
                {editingAccess === u.id && (
                  <tr>
                    <td colSpan={8} className="border-b border-line px-2 py-2">
                      <GrantAccess
                        user={u}
                        onClose={() => setEditingAccess(null)}
                        onDone={(access, message) => {
                          setItems((xs) => (xs ?? []).map((x) => (x.id === u.id ? { ...x, access } : x)));
                          setEditingAccess(null);
                          setDone(message);
                        }}
                      />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const TABS: [Tab, string][] = [
  ["overview", "Overview"],
  ["traffic", "Traffic"],
  ["ads", "Ads & revenue"],
  ["advertisers", "Advertisers"],
  ["abuse", "Abuse"],
  ["users", "People"],
  ["beta", "Beta"],
  ["learn", "Learn"],
  ["support", "Support"],
  ["messages", "Messages"],
];

export function AdminConsole() {
  const { isLoaded, isSignedIn } = useAuth();
  // The page shows "Checking access" first on the server and in the browser, so reading the hash here is safe.
  const [tab, setTab] = useState<Tab>(() => {
    const fromHash = (typeof window === "undefined" ? "" : window.location.hash.slice(1)) as Tab;
    return TABS.some(([t]) => t === fromHash) ? fromHash : "overview";
  });
  const [access, setAccess] = useState<"checking" | "ok" | "denied" | "error">("checking");
  const [role, setRole] = useState("");
  const [days, setDays] = useState<number>(30);
  const [person, setPerson] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      window.location.replace(`/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`);
      return;
    }
    api<{ role: string }>("/api/admin/overview")
      .then((d) => {
        setRole(d.role);
        setAccess("ok");
      })
      .catch((e: ApiError) => setAccess(e.status === 403 ? "denied" : "error"));
  }, [isLoaded, isSignedIn]);

  const go = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
  };

  if (access !== "ok")
    return (
      <div className="grid min-h-full place-items-center bg-bg p-6">
        <div className="flex max-w-[360px] flex-col items-center gap-2 text-center">
          <b className="font-display text-lg font-semibold">{access === "checking" ? "Checking access…" : access === "denied" ? "This page is for the Wanlly team" : "Couldn't reach the server"}</b>
          {access === "denied" && <p className="text-[13px] text-muted">Your account doesn&apos;t have an admin role.</p>}
          {access === "error" && <p className="text-[13px] text-muted">Refresh to try again.</p>}
          {access !== "checking" && (
            <Link href="/app" className="mt-2 text-[13px] underline underline-offset-2">
              Back to Wanlly
            </Link>
          )}
        </div>
      </div>
    );

  return (
    <div className="min-h-full bg-bg px-4 py-5 sm:px-6">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
        <header className="flex flex-wrap items-center gap-3">
          <Link href="/app" className="text-[13px] text-muted hover:text-fg">
            ← Wanlly
          </Link>
          <h1 className="font-display text-xl font-semibold tracking-[-0.02em]">Admin</h1>
          <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs text-muted capitalize">{role}</span>
          {(tab === "traffic" || tab === "ads") && (
            <div className="ml-auto">
              <Pills
                label="Date range"
                value={String(days) as "7" | "30" | "90" | "180" | "365"}
                onChange={(v) => setDays(Number(v))}
                options={[
                  ["7", "7d"],
                  ["30", "30d"],
                  ["90", "90d"],
                  ["180", "6m"],
                  ["365", "1y"],
                ]}
              />
            </div>
          )}
        </header>
        <nav className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
          <Pills label="Section" value={tab} onChange={go} options={TABS} />
        </nav>
        {tab === "overview" && <Overview go={go} />}
        {tab === "traffic" && <TrafficTab days={days} />}
        {tab === "ads" && <AdsTab days={days} />}
        {tab === "advertisers" && <AdvertisersTab />}
        {tab === "abuse" && (
          <AbuseTab
            onOpenPerson={(q) => {
              setPerson(q);
              go("users");
            }}
          />
        )}
        {tab === "users" && <Users key={person} initial={person} />}
        {tab === "beta" && <Beta />}
        {tab === "learn" && <LearnTab />}
        {tab === "messages" && <Messages />}
        {tab === "support" && (
          <SupportTab
            onPerson={(q) => {
              setPerson(q);
              go("users");
            }}
          />
        )}
      </div>
    </div>
  );
}
