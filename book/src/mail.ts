// Email. Sent through Resend when RESEND_API_KEY is set; otherwise printed to the log (local development).
import type { Env } from "./types";

export const fill = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)).replace(/\n{3,}/g, "\n\n").trim();

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const toHtml = (text: string) =>
  `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#18181B;max-width:560px">${esc(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#18181B">$1</a>')
    .replace(/\n/g, "<br>")}</div>`;

export async function sendMail(env: Env, m: { to: string; subject: string; text: string; fromName?: string; replyTo?: string }): Promise<"sent" | "logged" | "failed"> {
  if (!env.RESEND_API_KEY) {
    console.log(`\n--- email (not sent: no RESEND_API_KEY) ---\nTo: ${m.to}\nSubject: ${m.subject}\n\n${m.text}\n---\n`);
    return "logged";
  }
  const address = /<(.+)>/.exec(env.MAIL_FROM)?.[1] ?? env.MAIL_FROM;
  const from = m.fromName ? `${m.fromName.replace(/[<>"]/g, "")} via Wanlly Book <${address}>` : env.MAIL_FROM;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [m.to], subject: m.subject, text: m.text, html: toHtml(m.text), ...(m.replyTo ? { reply_to: m.replyTo } : {}) }),
    });
    if (!res.ok) console.error("Resend error", res.status, await res.text());
    return res.ok ? "sent" : "failed";
  } catch (e) {
    console.error("Resend request failed", e);
    return "failed";
  }
}
