/*
 * Wanlly's email look: a white card on a light grey page, the logo on top, one orange button.
 * Tables and inline styles only, since that is all email apps (Gmail, Outlook, phones) agree on.
 * Every email also has a plain-text version, sent alongside.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const INK = "#111114";
const MUTED = "#5b5e66";
const FAINT = "#8a8d95";
const LINE = "#e7e8ec";
const ACCENT = "#ff5a1f";

export type EmailContent = {
  /** The grey line inbox lists show after the subject. */
  preview: string;
  heading: string;
  /** Paragraphs of plain text; **bold** is allowed. */
  paragraphs: string[];
  button?: { label: string; url: string };
  /** Small print under the button, e.g. the link written out. */
  after?: string[];
  signoff?: string;
};

const rich = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, `<strong style="color:${INK};font-weight:600">$1</strong>`);

export function emailHtml(c: EmailContent, site: string): string {
  const p = (s: string, color = MUTED, size = 15) => `<p style="margin:0 0 16px;font:${size}px/1.6 ${FONT};color:${color}">${rich(s)}</p>`;
  const button = c.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr><td bgcolor="${ACCENT}" style="border-radius:10px">
<a href="${esc(c.button.url)}" style="display:inline-block;padding:13px 26px;font:600 15px/1 ${FONT};color:#ffffff;text-decoration:none;border-radius:10px">${esc(c.button.label)}</a>
</td></tr></table>`
    : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(c.heading)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f7">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(c.preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f4f7"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td style="padding:0 4px 20px"><a href="${esc(site)}"><img src="${esc(site)}/brand/wanlly-logo-email.png" width="119" height="32" alt="Wanlly" style="display:block;border:0;height:32px;width:119px"></a></td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;border:1px solid ${LINE};border-radius:16px;padding:36px 32px 20px">
<h1 style="margin:0 0 16px;font:700 24px/1.3 ${FONT};color:${INK};letter-spacing:-0.01em">${esc(c.heading)}</h1>
${c.paragraphs.map((s) => p(s)).join("\n")}
${button}
${(c.after ?? []).map((s) => p(s, FAINT, 13)).join("\n")}
${c.signoff ? `<p style="margin:8px 0 16px;padding-top:20px;border-top:1px solid ${LINE};font:15px/1.6 ${FONT};color:${INK}">${rich(c.signoff).replace(/\n/g, "<br>")}</p>` : ""}
</td></tr>
<tr><td style="padding:20px 4px 0;font:12px/1.6 ${FONT};color:${FAINT}">Wanlly · Frontier AI for everyone with an idea<br><a href="${esc(site)}" style="color:${FAINT}">${esc(site.replace(/^https?:\/\//, ""))}</a></td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** The same email as plain text, for apps that don't show HTML. */
export function emailText(c: EmailContent): string {
  const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1");
  return [
    plain(c.heading),
    ...c.paragraphs.map(plain),
    ...(c.button ? [`${c.button.label}: ${c.button.url}`] : []),
    ...(c.after ?? []).map(plain),
    ...(c.signoff ? [plain(c.signoff)] : []),
  ].join("\n\n");
}
