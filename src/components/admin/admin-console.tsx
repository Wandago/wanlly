"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

/* The real admin page. Every list and action goes through /api/admin, which checks the role. */

type Tab = "overview" | "beta" | "messages" | "users";
type Totals = Record<"users" | "newToday" | "activeToday" | "videosToday" | "earnedToday" | "spentToday" | "betaPending" | "betaTotal" | "messagesOpen" | "paused", number>;
type Day = { day: string; signups: number; active: number; videos: number; spent: number; applications: number };
type Application = { id: number; name: string; email: string; country: string | null; build: string; source: string | null; referralCode: string | null; inviteCode: string; networkCountry: string | null; status: "pending" | "approved" | "declined"; createdAt: string };
type Message = { id: number; name: string; email: string; topic: string; message: string; networkCountry: string | null; handledAt: string | null; createdAt: string };
type User = { id: string; email: string | null; name: string | null; country: string | null; role: string; status: string; createdAt: string; credits: number; spentToday: number; lastActive: string | null };

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function api<T>(url: string, method = "GET", body?: object): Promise<T> {
  const r = await fetch(url, { method, cache: "no-store", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(data.error ?? "Something went wrong", r.status);
  return data as T;
}

const num = (v: number) => v.toLocaleString("en-US");
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const btnDark = "inline-flex items-center gap-1.5 rounded-lg bg-fg px-2.5 py-1 text-xs font-semibold text-bg disabled:opacity-50";
const btnGhost = "inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium hover:border-faint disabled:opacity-50";

function Card({ title, note, actions, children }: { title: string; note?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <header className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {note && <p className="text-[13px] text-muted">{note}</p>}
        </div>
        {actions && <div className="ml-auto flex flex-wrap gap-1.5">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-line bg-surface p-3.5">
      <span className="text-[11px] font-medium tracking-[0.08em] text-faint uppercase">{label}</span>
      <span className="font-display text-2xl leading-none font-semibold tabular-nums">{num(value)}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}

function Pills<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="inline-flex flex-wrap gap-0.5 rounded-[10px] bg-hover p-[3px]" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`rounded-lg px-2.5 py-1 text-[13px] ${value === v ? "bg-surface font-medium text-fg shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-code px-3 py-6 text-center text-[13px] text-muted">{children}</p>;
}

const STATUS_CHIP: Record<string, string> = {
  pending: "bg-hover text-muted",
  approved: "bg-good/12 text-good",
  declined: "bg-bad/12 text-bad",
  active: "bg-good/12 text-good",
  slowed: "bg-hover text-muted",
  challenged: "bg-hover text-muted",
  frozen: "bg-bad/12 text-bad",
  banned: "bg-bad/12 text-bad",
  deleted: "bg-hover text-faint",
};
const Chip = ({ s }: { s: string }) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap capitalize ${STATUS_CHIP[s] ?? "bg-hover text-muted"}`}>{s}</span>;

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

function Overview({ go }: { go: (t: Tab) => void }) {
  const [data, setData] = useState<{ totals: Totals; days: Day[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ totals: Totals; days: Day[] }>("/api/admin/overview")
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);
  if (error) return <Empty>{error}</Empty>;
  if (!data) return <Empty>Loading…</Empty>;
  const t = data.totals;
  return (
    <div className="flex flex-col gap-4">
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
        <button type="button" onClick={() => go("users")} className="text-left">
          <Kpi label="Paused accounts" value={t.paused} sub="frozen or banned →" />
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
      <p className="text-xs text-faint">
        Ad revenue, networks and per-country margins appear once a real ad network reports them.{" "}
        <Link href="/admin/preview" className="underline underline-offset-2 hover:text-fg">
          See the design with sample data
        </Link>
      </p>
    </div>
  );
}

function inviteMail(a: Application) {
  const site = window.location.origin;
  const first = a.name.split(" ")[0];
  const body = `Hi ${first},\n\nYou're in. Thanks for applying to the Wanlly beta.\n\nSign up here: ${site}/sign-up\nYour invite code: ${a.inviteCode}\n\nWatch short sponsor videos to earn credits, then build with Claude or Gemini. Reply to this email if anything breaks.\n\nLouis, Wanlly`;
  return `mailto:${encodeURIComponent(a.email)}?subject=${encodeURIComponent("You're in: your Wanlly beta invite")}&body=${encodeURIComponent(body)}`;
}

function Beta() {
  const [status, setStatus] = useState<"pending" | "approved" | "declined" | "all">("pending");
  const { items, setItems, error } = useList<Application>(`/api/admin/beta${status === "all" ? "" : `?status=${status}`}`, "applications");
  const [busy, setBusy] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const decide = async (a: Application, next: Application["status"]) => {
    setBusy(a.id);
    setNote("");
    try {
      const { application } = await api<{ application: Application }>(`/api/admin/beta/${a.id}`, "PATCH", { status: next });
      setItems((xs) => (xs ?? []).map((x) => (x.id === a.id ? application : x)));
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card
      title="Beta applications"
      note="Approve, then send the invite from your own email. Decisions are logged."
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
      {note && <p className="text-[13px] text-bad">{note}</p>}
      {error ? (
        <Empty>{error}</Empty>
      ) : !items ? (
        <Empty>Loading…</Empty>
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
                  {[a.country && `Says ${a.country}`, a.networkCountry && `network ${a.networkCountry}`, a.source && `heard via ${a.source}`, a.referralCode && `referred by ${a.referralCode}`, `applied ${when(a.createdAt)}`, `code ${a.inviteCode}`]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {a.status === "approved" && (
                  <a href={inviteMail(a)} className={btnDark}>
                    Email invite
                  </a>
                )}
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
  );
}

function Messages() {
  const [show, setShow] = useState<"open" | "handled" | "all">("open");
  const { items, setItems, error } = useList<Message>(`/api/admin/messages?show=${show}`, "messages");
  const [note, setNote] = useState("");

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
      note="From the contact page. Reply from your own email, then mark it handled."
      actions={
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
      }
    >
      {note && <p className="text-[13px] text-bad">{note}</p>}
      {error ? (
        <Empty>{error}</Empty>
      ) : !items ? (
        <Empty>Loading…</Empty>
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
              </div>
              <div className="flex flex-wrap gap-1.5">
                <a href={reply(m)} className={btnDark}>
                  Reply
                </a>
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

function Users() {
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const { items, setItems, extra, error } = useList<User>(`/api/admin/users${query ? `?q=${encodeURIComponent(query)}` : ""}`, "users");
  const [note, setNote] = useState("");
  const canEdit = extra.canEdit === true;

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
      note="Frozen and banned accounts can't earn or spend credits. Every change needs a reason and is logged."
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
      {error ? (
        <Empty>{error}</Empty>
      ) : !items ? (
        <Empty>Loading…</Empty>
      ) : items.length === 0 ? (
        <Empty>No one matches.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-muted">
                {["Person", "Country", "Joined", "Last active", "Credits", "Used today", "Status"].map((h, i) => (
                  <th key={h} className={`border-b border-line px-2 py-2 font-medium whitespace-nowrap ${i === 4 || i === 5 ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="hover:bg-hover/60">
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
                  <td className="border-b border-line px-2 py-1.5 text-right font-mono tabular-nums">{num(u.credits)}</td>
                  <td className="border-b border-line px-2 py-1.5 text-right font-mono tabular-nums">{num(u.spentToday)}</td>
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
  ["beta", "Beta"],
  ["messages", "Messages"],
  ["users", "People"],
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
          <div className="ml-auto">
            <Pills label="Section" value={tab} onChange={go} options={TABS} />
          </div>
        </header>
        {tab === "overview" && <Overview go={go} />}
        {tab === "beta" && <Beta />}
        {tab === "messages" && <Messages />}
        {tab === "users" && <Users />}
      </div>
    </div>
  );
}
