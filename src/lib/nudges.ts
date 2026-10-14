import "server-only";
import { createHmac } from "node:crypto";
import { rawSql } from "@/db";
import { emailHtml, emailText, type EmailContent } from "./email-layout";
import { mailReady, sendMail } from "./mail";
import { SITE_URL } from "./site";

/*
 * Come-back emails ("nudges"):
 *  - beta1 / beta2: approved beta applicants who never created their account (2 and 7+ days after
 *    approval), mentioning what they said they wanted to build.
 *  - idle7 / idle21: people who stopped using Wanlly, about the project or chat they last worked
 *    on (its name or title only, never what they wrote), or ideas to start with if they never did.
 * Each person gets at most two per quiet spell; using Wanlly again starts a new spell. Anyone can
 * unsubscribe in one click, and account holders can turn them off on their Profile page.
 * Sent daily by the Worker's cron (workers/site/entry.js) when Admin → Beta → Come-back emails is
 * on, or by hand from that card.
 */

export type NudgeKind = "beta1" | "beta2" | "idle7" | "idle21";
export type Nudge = { kind: NudgeKind; email: string; userId: string | null; ref: string; subject: string; text: string; html: string };

const DAY = 86_400_000;
const ms = (d: string | Date) => new Date(d).getTime();
/** Most emails one run sends: SMTP is slow, and a Worker run is short. */
export const MAX_PER_RUN = 20;

// Topics never echoed back in an email, even as a title.
const SENSITIVE = /\b(suicid\w*|self[- ]harm|depress\w*|anxiety|therap\w*|diagnos\w*|symptom\w*|medic\w*|pregnan\w*|hiv|cancer|abortion|politic\w*|election\w*|religio\w*|abuse\w*|debt|loan|gambl\w*|betting|divorce|sex\w*|password\w*)\b/i;

/** A name, title or "what I want to build" safe to quote: short, no markup, nothing sensitive. */
function quotable(s: string | null | undefined, max = 80): string | null {
  const t = (s ?? "").replace(/[*_`<>]/g, "").replace(/\s+/g, " ").trim();
  if (!t || t.length < 3 || SENSITIVE.test(t) || /^new (chat|project)$/i.test(t)) return null;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

const firstName = (name: string | null | undefined, email: string) => {
  const n = (name ?? "").trim();
  return !n || n.toLowerCase() === email.split("@")[0].toLowerCase() ? "" : n.split(/\s+/)[0];
};

// ---------------------------------------------------------------- unsubscribe

function secret() {
  return process.env.NUDGE_SECRET || process.env.CLERK_SECRET_KEY || "wanlly";
}
export function unsubToken(email: string) {
  return createHmac("sha256", secret()).update(email.trim().toLowerCase()).digest("hex").slice(0, 32);
}
export function unsubUrl(email: string) {
  const e = email.trim().toLowerCase();
  return `${SITE_URL}/api/unsubscribe?e=${encodeURIComponent(e)}&t=${unsubToken(e)}`;
}
export async function optOut(email: string) {
  await ensureNudgeTables();
  await rawSql()`insert into email_optouts (email) values (${email.trim().toLowerCase()}) on conflict do nothing`;
}

let ready = false;
export async function ensureNudgeTables() {
  if (ready) return;
  const q = rawSql();
  await q`create table if not exists email_nudges (id bigserial primary key, email text not null, user_id text, ref text not null, sent_at timestamptz not null default now(), unique (email, ref))`;
  await q`create table if not exists email_optouts (email text primary key, created_at timestamptz not null default now())`;
  ready = true;
}

// ---------------------------------------------------------------- templates

function render(kind: NudgeKind, email: string, subject: string, c: Omit<EmailContent, "after" | "signoff"> & { after?: string[] }) {
  const reason = kind.startsWith("beta") ? "you applied to the Wanlly beta" : "you have a Wanlly account";
  const content: EmailContent = {
    ...c,
    after: [...(c.after ?? []), "Louis, Wanlly", `You're getting this because ${reason}. Don't want these? Unsubscribe: ${unsubUrl(email)}`],
  };
  return { subject: subject.charAt(0).toUpperCase() + subject.slice(1), text: emailText(content), html: emailHtml(content, SITE_URL) };
}

function betaEmail(stage: 1 | 2, a: { name: string; email: string; build: string | null }) {
  const name = firstName(a.name, a.email);
  const raw = quotable(a.build, 120);
  // "build A website…" reads oddly mid-sentence; acronyms ("AI tool") keep their capitals.
  const idea = raw && /^[A-Z][a-z\s]/.test(raw) ? raw.charAt(0).toLowerCase() + raw.slice(1) : raw;
  const kind = stage === 1 ? "beta1" : "beta2";
  return render(kind, a.email, stage === 1 ? `${name ? `${name}, your` : "Your"} Wanlly place is ready` : "Last reminder: your Wanlly beta place", {
    preview: idea ? `You wanted to build: ${idea}. Start it in a couple of minutes.` : "Create your account and build your first thing in a couple of minutes.",
    heading: stage === 1 ? (name ? `Your place is ready, ${name}` : "Your place is ready") : "Still want to build it?",
    paragraphs: [
      idea ? `When you applied, you told us you want to build **${idea}**. You can start on it today, free.` : "You applied to the Wanlly beta, and your place has been ready for a few days.",
      `Create your account with **${a.email}**, the address you applied with, and Wanlly will let you straight in.`,
      stage === 1
        ? "Describe what you want in plain words and Wanlly builds it: a website, code, a poster or a plan. Watch a short sponsor ad when you need more credits. No card, no subscription."
        : "This is our last reminder. If now isn't the right time, no problem: your place stays open.",
    ],
    button: { label: "Create your account", url: `${SITE_URL}/sign-up` },
    after: ["Questions? Just reply to this email; a person reads every one."],
  });
}

type Last = { tool: string | null; kind?: string | null; projectId: number | null; title: string | null; credits: number };

function idleEmail(stage: 7 | 21, u: { name: string | null; email: string }, last: Last) {
  const name = firstName(u.name, u.email);
  const hi = name ? `${name}, ` : "";
  const kind = stage === 7 ? "idle7" : "idle21";
  const title = quotable(last.title);
  const credits = last.credits > 0 ? `You still have **${last.credits} credits** waiting.` : "Your first ad each day gives you a bonus to start with.";
  const open = (path: string, label: string) => ({ label, url: `${SITE_URL}${path}` });

  if (title && last.projectId && last.tool === "code" && last.kind === "build")
    return render(kind, u.email, stage === 7 ? `${hi}“${title}” is waiting for you` : `Ready to put “${title}” online?`, {
      preview: "It's saved exactly where you left it. Publish it in one click.",
      heading: stage === 7 ? `Ready to finish “${title}”?` : `“${title}” could be live today`,
      paragraphs: [
        `You started **${title}** on Wanlly. It's saved exactly where you left it.`,
        "Most people finish with three small steps: add their real details, press Publish, and share the link. When friends join Wanlly from your app, you both get 20 credits.",
        credits,
      ],
      button: open(`/build/${last.projectId}`, `Open ${title.length > 28 ? "your app" : title}`),
    });
  if (title && last.projectId && last.tool === "design")
    return render(kind, u.email, stage === 7 ? `${hi}your design “${title}” is one tweak away` : `Want another version of “${title}”?`, {
      preview: "Ask for a change in plain words, then download it.",
      heading: `Back to “${title}”?`,
      paragraphs: [`Your design **${title}** is saved. Ask for any change in plain words ("bigger title", "make it orange", "add the date"), then download it to share.`, credits],
      button: open(`/design/${last.projectId}`, "Open your design"),
    });
  if (title)
    return render(kind, u.email, stage === 7 ? `${hi}still working on “${title}”?` : `Take “${title}” further`, {
      preview: "Pick up where you left off, or turn it into something you can share.",
      heading: `Still working on “${title}”?`,
      paragraphs: [
        `Last time you asked Wanlly about **${title}**. Want to take it further? Ask a follow-up, or turn it into a plan, a one-page site or a poster in a minute.`,
        credits,
      ],
      button: open("/app", "Continue on Wanlly"),
    });
  return render(kind, u.email, stage === 7 ? `${hi}your first build takes two minutes` : "Three things to make on Wanlly this week", {
    preview: "A website, a poster or a study plan, free.",
    heading: "Not sure where to start?",
    paragraphs: [
      "Here are three things people make in their first two minutes on Wanlly:",
      "**A page for your hustle:** \"Build a booking page for my salon in Nairobi\" (Code)",
      "**A poster:** \"Poster for our campus event on Saturday\" (Design)",
      "**A plan:** \"Make me a 2-week revision plan for my exams\" (Chat)",
      credits,
    ],
    button: open("/app", "Try one now"),
  });
}

// ---------------------------------------------------------------- who's due

/** Everyone due an email now, oldest need first. Nothing is sent. */
export async function dueNudges(limit = 200): Promise<Nudge[]> {
  await ensureNudgeTables();
  const q = rawSql();
  const out: Nudge[] = [];
  const now = Date.now();

  // Approved applicants with no account under that email.
  const beta = (await q`
    select b.name, lower(b.email) as email, b.build, b.reviewed_at,
      (select max(sent_at) from email_nudges n where n.email = lower(b.email) and n.ref = 'beta1') as beta1,
      exists (select 1 from email_nudges n where n.email = lower(b.email) and n.ref = 'beta2') as beta2
    from beta_applications b
    where b.status = 'approved' and b.reviewed_at < now() - interval '2 days' and b.reviewed_at > now() - interval '60 days'
      and not exists (select 1 from users u where lower(u.email) = lower(b.email))
      and not exists (select 1 from email_optouts o where o.email = lower(b.email))
    order by b.reviewed_at
    limit ${limit}`) as { name: string; email: string; build: string | null; reviewed_at: string | Date; beta1: string | Date | null; beta2: boolean }[];
  for (const b of beta) {
    if (!b.beta1) out.push({ kind: "beta1", email: b.email, userId: null, ref: "beta1", ...betaEmail(1, b) });
    else if (!b.beta2 && now - ms(b.reviewed_at) >= 7 * DAY && now - ms(b.beta1) >= 5 * DAY) out.push({ kind: "beta2", email: b.email, userId: null, ref: "beta2", ...betaEmail(2, b) });
  }

  // Accounts quiet for a week or more (but not long gone), who haven't turned these off.
  const idle = (await q`
    with act as (
      select u.id, u.name, lower(u.email) as email,
        greatest(u.created_at,
          coalesce((select max(l.created_at) from ledger_entries l where l.user_id = u.id), u.created_at),
          coalesce((select max(c.created_at) from conversations c where c.user_id = u.id), u.created_at)) as last_active
      from users u
      where u.status = 'active' and u.email is not null
        and coalesce((u.settings -> 'notify' ->> 'comeBack')::boolean, true)
        and not exists (select 1 from email_optouts o where o.email = lower(u.email))
    )
    select a.*,
      (select coalesce(sum(delta), 0)::int from ledger_entries l where l.user_id = a.id) as credits,
      (select row_to_json(p) from (select id, name, tool, kind from projects where owner_id = a.id and deleted_at is null order by updated_at desc limit 1) p) as project,
      (select title from conversations where user_id = a.id and title <> 'New chat' order by created_at desc limit 1) as chat
    from act a
    where a.last_active < now() - interval '7 days' and a.last_active > now() - interval '60 days'
    order by a.last_active desc
    limit ${limit}`) as { id: string; name: string | null; email: string; last_active: string | Date; credits: number; project: { id: number; name: string; tool: string; kind: string | null } | null; chat: string | null }[];
  if (idle.length) {
    const refs = (await q`select email, ref, sent_at from email_nudges where email = any(${idle.map((i) => i.email)}) and ref like 'idle%'`) as { email: string; ref: string; sent_at: string | Date }[];
    for (const u of idle) {
      const spell = new Date(u.last_active).toISOString().slice(0, 10);
      const sent7 = refs.find((r) => r.email === u.email && r.ref === `idle7:${spell}`);
      const sent21 = refs.some((r) => r.email === u.email && r.ref === `idle21:${spell}`);
      const quietDays = (now - ms(u.last_active)) / DAY;
      const last: Last = u.project ? { tool: u.project.tool, kind: u.project.kind, projectId: u.project.id, title: u.project.name, credits: u.credits } : { tool: "chat", projectId: null, title: u.chat, credits: u.credits };
      if (!sent7) out.push({ kind: "idle7", email: u.email, userId: u.id, ref: `idle7:${spell}`, ...idleEmail(7, u, last) });
      else if (!sent21 && quietDays >= 21 && now - ms(sent7.sent_at) >= 10 * DAY) out.push({ kind: "idle21", email: u.email, userId: u.id, ref: `idle21:${spell}`, ...idleEmail(21, u, last) });
    }
  }
  return out;
}

/** Sends what's due, up to MAX_PER_RUN, logging each so nobody gets the same email twice. */
export async function sendNudges(limit = MAX_PER_RUN) {
  if (!mailReady()) return { sent: 0, failed: 0, due: 0, error: "Email isn't set up (SMTP_USER / SMTP_PASS)" };
  const due = await dueNudges();
  let sent = 0;
  let failed = 0;
  for (const n of due.slice(0, limit)) {
    // Claim it first: a second run at the same moment skips it instead of sending it again.
    const claimed = (await rawSql()`insert into email_nudges (email, user_id, ref) values (${n.email}, ${n.userId}, ${n.ref}) on conflict do nothing returning id`) as { id: number }[];
    if (!claimed.length) continue;
    try {
      await sendMail({ to: n.email, subject: n.subject, text: n.text, html: n.html, unsubscribe: unsubUrl(n.email) });
      sent++;
    } catch (e) {
      failed++;
      console.error("nudge failed", n.ref, e);
      await rawSql()`delete from email_nudges where id = ${claimed[0].id}`.catch(() => {});
    }
  }
  return { sent, failed, due: due.length };
}

/** Totals for the admin card: what's been sent in the last 30 days, by kind. */
export async function nudgeStats() {
  await ensureNudgeTables();
  const rows = (await rawSql()`
    select split_part(ref, ':', 1) as kind, count(*)::int as n from email_nudges where sent_at > now() - interval '30 days' group by 1`) as { kind: string; n: number }[];
  const [{ optouts }] = (await rawSql()`select count(*)::int as optouts from email_optouts`) as { optouts: number }[];
  return { sent30: Object.fromEntries(rows.map((r) => [r.kind, r.n])), optouts };
}
