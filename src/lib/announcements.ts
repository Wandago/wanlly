import "server-only";
import { rawSql } from "@/db";
import { emailHtml, emailText, type EmailContent } from "./email-layout";
import { mailReady, sendMail } from "./mail";
import { ensureNudgeTables, unsubUrl } from "./nudges";
import { SITE_URL } from "./site";

/*
 * Announcements: one email about a big launch or important update, written in Admin → Beta →
 * Announcements, previewed, test-sent to yourself, then sent in batches (the Worker's hourly cron
 * sends BATCH at a time; "Send next batch now" sends one straight away). Each address gets it once
 * (logged in email_nudges as "ann:<id>"). Goes to accounts that haven't turned off Product news,
 * and/or approved beta applicants who haven't made an account yet (pending ones can't use it, so
 * they wait for their invite); never to anyone who unsubscribed.
 */

export const AUDIENCES = ["users", "beta", "all"] as const;
export type Audience = (typeof AUDIENCES)[number];
export const BATCH = 40;

export type Announcement = {
  id: number;
  subject: string;
  heading: string;
  body: string;
  buttonLabel: string | null;
  buttonUrl: string | null;
  audience: Audience;
  status: "draft" | "sending" | "paused" | "sent";
  sent: number;
  createdAt: string;
  finishedAt: string | null;
};

let ready = false;
export async function ensureAnnouncements() {
  if (ready) return;
  await ensureNudgeTables();
  await rawSql()`create table if not exists announcements (
    id bigserial primary key, subject text not null, heading text not null, body text not null,
    button_label text, button_url text, audience text not null default 'users', status text not null default 'draft',
    sent int not null default 0, created_by text, created_at timestamptz not null default now(), finished_at timestamptz)`;
  ready = true;
}

const row = (r: Record<string, unknown>): Announcement => ({
  id: Number(r.id),
  subject: String(r.subject),
  heading: String(r.heading),
  body: String(r.body),
  buttonLabel: (r.button_label as string) ?? null,
  buttonUrl: (r.button_url as string) ?? null,
  audience: (AUDIENCES as readonly string[]).includes(String(r.audience)) ? (r.audience as Audience) : "users",
  status: r.status as Announcement["status"],
  sent: Number(r.sent ?? 0),
  createdAt: new Date(r.created_at as string).toISOString(),
  finishedAt: r.finished_at ? new Date(r.finished_at as string).toISOString() : null,
});

export async function listAnnouncements(): Promise<Announcement[]> {
  await ensureAnnouncements();
  return ((await rawSql()`select * from announcements order by created_at desc limit 30`) as Record<string, unknown>[]).map(row);
}
export async function getAnnouncement(id: number): Promise<Announcement | null> {
  await ensureAnnouncements();
  const [r] = (await rawSql()`select * from announcements where id = ${id}`) as Record<string, unknown>[];
  return r ? row(r) : null;
}

/** The email itself. **bold** works; blank lines start new paragraphs. */
export function renderAnnouncement(a: Pick<Announcement, "subject" | "heading" | "body" | "buttonLabel" | "buttonUrl">, email: string) {
  const content: EmailContent = {
    preview: a.body.replace(/\*\*/g, "").replace(/\s+/g, " ").slice(0, 120),
    heading: a.heading,
    paragraphs: a.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
    button: a.buttonLabel && a.buttonUrl ? { label: a.buttonLabel, url: a.buttonUrl } : undefined,
    after: ["Louis, Wanlly", `You're getting this because you use or applied to Wanlly. Turn off Product news on your Profile, or unsubscribe: ${unsubUrl(email)}`],
  };
  return { subject: a.subject, text: emailText(content), html: emailHtml(content, SITE_URL) };
}

/** Who an audience reaches now, minus anyone already sent `ref` (when given). */
async function recipients(audience: Audience, ref: string | null, limit: number): Promise<string[]> {
  const q = rawSql();
  const users = audience !== "beta";
  const beta = audience !== "users";
  const rows = (await q`
    select email from (
      select lower(u.email) as email from users u
      where ${users} and u.status = 'active' and u.email is not null
        and coalesce(u.settings -> 'notify' ->> 'productNews', 'true') <> 'false'
      union
      select lower(b.email) from beta_applications b
      where ${beta} and b.status = 'approved'
        and not exists (select 1 from users u where lower(u.email) = lower(b.email))
    ) r
    where not exists (select 1 from email_optouts o where o.email = r.email)
      and (${ref}::text is null or not exists (select 1 from email_nudges n where n.email = r.email and n.ref = ${ref}))
    order by email
    limit ${limit}`) as { email: string }[];
  return rows.map((r) => r.email);
}

export async function audienceCounts(): Promise<Record<Audience, number>> {
  await ensureAnnouncements();
  const [u, b, a] = await Promise.all(AUDIENCES.map((x) => recipients(x, null, 100_000)));
  return { users: u.length, beta: b.length, all: a.length };
}

/** Sends the next batch of one announcement; marks it sent when nobody's left. */
export async function sendAnnouncementBatch(id: number, limit = BATCH) {
  const a = await getAnnouncement(id);
  if (!a || a.status !== "sending") return { sent: 0, left: 0, error: a ? "It isn't sending." : "Not found" };
  if (!mailReady()) return { sent: 0, left: 0, error: "Email isn't set up (SMTP_USER / SMTP_PASS)" };
  const ref = `ann:${id}`;
  const batch = await recipients(a.audience, ref, limit);
  let sent = 0;
  for (const email of batch) {
    const claimed = (await rawSql()`insert into email_nudges (email, ref) values (${email}, ${ref}) on conflict do nothing returning id`) as { id: number }[];
    if (!claimed.length) continue;
    try {
      const m = renderAnnouncement(a, email);
      await sendMail({ to: email, subject: m.subject, text: m.text, html: m.html, unsubscribe: unsubUrl(email) });
      sent++;
    } catch (e) {
      console.error("announcement email failed", id, e instanceof Error ? e.message : e);
      await rawSql()`delete from email_nudges where id = ${claimed[0].id}`.catch(() => {});
    }
  }
  const left = (await recipients(a.audience, ref, 1)).length;
  await rawSql()`update announcements set sent = sent + ${sent}, status = case when ${left} = 0 then 'sent' else status end, finished_at = case when ${left} = 0 then now() else finished_at end where id = ${id}`;
  return { sent, left };
}

/** For the hourly cron: a batch of every announcement that's sending. */
export async function sendPendingAnnouncements() {
  await ensureAnnouncements();
  const ids = ((await rawSql()`select id from announcements where status = 'sending' order by created_at`) as { id: number }[]).map((r) => Number(r.id));
  const results = [];
  for (const id of ids) results.push({ id, ...(await sendAnnouncementBatch(id)) });
  return results;
}
