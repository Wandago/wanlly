import "server-only";
import { emailHtml, emailText } from "./email-layout";
import { mailReady, sendMail } from "./mail";
import { SITE_URL } from "./site";

/*
 * Tells the team something happened (a beta application, a sign-up, a message…), on whichever
 * channels are set up in Cloudflare (Workers → wanlly → Settings → Variables):
 *
 *   ALERT_EMAIL         an address to email (default: the first OWNER_EMAILS address)
 *   TELEGRAM_BOT_TOKEN  a bot from @BotFather, plus
 *   TELEGRAM_CHAT_ID    your chat with it (instant phone notifications, free)
 *   NTFY_TOPIC          a private topic name on ntfy.sh (push to the ntfy app, free, no account)
 *   ALERTS              which kinds to send, comma separated (default: all of them)
 *
 * Never throws and never takes long: a failed or slow channel is skipped.
 */
export type AlertKind = "beta" | "signup" | "contact" | "advertiser" | "support" | "offer";

const LABEL: Record<AlertKind, string> = {
  beta: "Beta application",
  signup: "New sign-up",
  contact: "Contact message",
  advertiser: "Advertiser enquiry",
  support: "Support ticket",
  offer: "Campaign offer",
};

const enabled = (kind: AlertKind) => {
  const list = (process.env.ALERTS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return !list.length || list.includes(kind) || list.includes("all");
};

const inbox = () => process.env.ALERT_EMAIL?.trim() || (process.env.OWNER_EMAILS ?? "").split(",")[0]?.trim() || null;

const within = <T,>(p: Promise<T>, ms = 4000) => Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

export async function alertTeam(kind: AlertKind, title: string, lines: string[], opts: { link?: string; email?: boolean } = {}) {
  if (!enabled(kind)) return;
  const link = opts.link ?? `${SITE_URL}/admin`;
  const heading = `${LABEL[kind]}: ${title}`;
  const body = lines.filter(Boolean).join("\n");
  const jobs: Promise<unknown>[] = [];

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chat = process.env.TELEGRAM_CHAT_ID?.trim();
  if (token && chat)
    jobs.push(
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text: `🔔 ${heading}\n${body}\n${link}`.slice(0, 3900), disable_web_page_preview: true }),
      }),
    );

  const topic = process.env.NTFY_TOPIC?.trim();
  if (topic && /^[\w-]{1,64}$/.test(topic))
    jobs.push(
      fetch(`https://ntfy.sh/${topic}`, {
        method: "POST",
        headers: { Title: heading.replace(/[^\x20-\x7e]/g, "").slice(0, 200), Click: link, Tags: "bell" },
        body: body.slice(0, 3000) || heading,
      }),
    );

  const to = inbox();
  if (opts.email !== false && to && mailReady()) {
    const content = { preview: body.slice(0, 120), heading, paragraphs: lines.filter(Boolean).map((l) => l.slice(0, 1500)), button: { label: "Open Admin", url: link }, signoff: "Wanlly" };
    jobs.push(sendMail({ to, subject: `[Wanlly] ${heading}`.slice(0, 180), text: emailText(content), html: emailHtml(content, SITE_URL) }));
  }

  const results = await Promise.allSettled(jobs.map((j) => within(j)));
  for (const r of results) if (r.status === "rejected") console.error("alert failed", kind, r.reason instanceof Error ? r.reason.message : r.reason);
}
