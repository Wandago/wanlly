import "server-only";
import { rawSql } from "@/db";
import { alertTeam } from "./alerts";
import { emailHtml, emailText } from "./email-layout";
import { mailReady, sendMail } from "./mail";
import { SITE_URL } from "./site";

export const SUPPORT_CATEGORIES = ["bug", "credits", "account", "builder", "ads", "idea", "other"] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

/*
 * The support tables (drizzle/0019_support.sql) are created on first use, so tickets work as soon
 * as this is deployed, without anyone running SQL by hand. Each statement is safe to run again.
 */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS "support_tickets" ("id" bigserial PRIMARY KEY NOT NULL, "user_id" text NOT NULL REFERENCES "users"("id"), "email" text, "subject" text NOT NULL, "category" text NOT NULL, "status" text DEFAULT 'open' NOT NULL, "page" text, "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS "support_tickets_user" ON "support_tickets" ("user_id", "updated_at")`,
  `CREATE INDEX IF NOT EXISTS "support_tickets_status" ON "support_tickets" ("status", "updated_at")`,
  `CREATE TABLE IF NOT EXISTS "support_messages" ("id" bigserial PRIMARY KEY NOT NULL, "ticket_id" bigint NOT NULL REFERENCES "support_tickets"("id"), "from_staff" boolean DEFAULT false NOT NULL, "author_id" text NOT NULL, "body" text NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS "support_messages_ticket" ON "support_messages" ("ticket_id", "created_at")`,
];
let ready: Promise<void> | null = null;
export function ensureSupportTables(): Promise<void> {
  ready ??= (async () => {
    const q = rawSql();
    for (const s of SCHEMA) await q.query(s);
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

/** Where new tickets are announced: SUPPORT_EMAIL, else the first OWNER_EMAILS address, else the mailbox Wanlly sends from. */
function teamInbox(): string | null {
  const first = (process.env.OWNER_EMAILS ?? "").split(",")[0]?.trim();
  return process.env.SUPPORT_EMAIL?.trim() || first || process.env.SMTP_USER?.trim() || null;
}

/** Tells the team a ticket needs them. Never throws: the ticket is saved either way. */
export async function notifyTeam(t: { id: number; subject: string; category: string; email: string | null; body: string; reply?: boolean }) {
  await alertTeam("support", `#${t.id} ${t.subject}`, [`${t.email ?? "Someone"} · ${t.category}${t.reply ? " · new reply" : ""}`, t.body.slice(0, 600)], { link: `${SITE_URL}/admin#support`, email: false });
  const to = teamInbox();
  if (!to || !mailReady()) return;
  const content = {
    preview: t.body.slice(0, 120),
    heading: t.reply ? `New reply on ticket #${t.id}` : `New ticket #${t.id}: ${t.subject}`,
    paragraphs: [`**${t.email ?? "Someone"}** · ${t.category}`, t.body.slice(0, 2000)],
    button: { label: "Open in admin", url: `${SITE_URL}/admin#support` },
    signoff: "Wanlly",
  };
  await sendMail({ to, replyTo: t.email ?? undefined, subject: `[Wanlly support] #${t.id} ${t.subject}`, text: emailText(content), html: emailHtml(content, SITE_URL) }).catch((e) =>
    console.error("support team email failed", e instanceof Error ? e.message : e),
  );
}

/** Tells the person the team answered. Never throws. */
export async function notifyPerson(t: { id: number; subject: string; email: string | null; body: string }) {
  if (!t.email || !mailReady()) return;
  const content = {
    preview: t.body.slice(0, 120),
    heading: "We replied to your ticket",
    paragraphs: [`About: **${t.subject}**`, t.body.slice(0, 2000)],
    button: { label: "See the conversation", url: `${SITE_URL}/support?ticket=${t.id}` },
    after: ["Reply on the Help page so the whole conversation stays in one place."],
    signoff: "The Wanlly team",
  };
  await sendMail({ to: t.email, subject: `Re: ${t.subject} [#${t.id}]`, text: emailText(content), html: emailHtml(content, SITE_URL) }).catch((e) =>
    console.error("support reply email failed", e instanceof Error ? e.message : e),
  );
}
