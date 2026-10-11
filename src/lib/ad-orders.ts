import "server-only";
import { rawSql } from "@/db";
import { alertTeam } from "./alerts";
import { emailHtml, emailText } from "./email-layout";
import { mailReady, sendMail } from "./mail";
import { SITE_URL } from "./site";

/*
 * Self-serve advertising: an advertiser builds a campaign, sets a budget and offers a price; the
 * team accepts, counters or declines; once the price is agreed and the payment is in, the
 * campaign goes live and stops when its spend reaches the budget.
 */

/** Where a visual campaign shows: every banner and sponsor-card space in the app. */
export const VISUAL_PLACEMENTS = ["rail_cover", "rail_banner", "rail_extra", "sidebar_card", "phone_banner", "tablet_banner", "job_card", "job_line", "between_turns", "home_banner", "builder_banner", "builder_code", "support_banner", "profile_side", "projects_banner"];
/** A suggested ad shows under an AI answer when the conversation matches its topics. */
export const SUGGESTED_PLACEMENTS = ["suggested"];

/** Starting prices shown to advertisers, in US cents (they can offer anything; the team decides). */
export const GUIDE = { visualCpm: 300, suggestedCpm: 600, suggestedCpc: 10, minBudget: 2000 } as const;

/*
 * The self-serve columns (drizzle/0020_self_serve_ads.sql) are added on first use, so this works as
 * soon as it's deployed. Checked once per worker; nothing is altered when they already exist.
 */
const COLUMNS: [string, string][] = [
  ["cpc_cents", `integer DEFAULT 0 NOT NULL`],
  ["budget_cents", `integer`],
  ["keywords", `jsonb DEFAULT '[]'::jsonb NOT NULL`],
  ["source", `text DEFAULT 'admin' NOT NULL`],
  ["email", `text`],
  ["token_hash", `text`],
  ["offer_status", `text`],
  ["offers", `jsonb DEFAULT '[]'::jsonb NOT NULL`],
  ["paid_at", `timestamp with time zone`],
];
let ready: Promise<void> | null = null;
export function ensureCampaignColumns(): Promise<void> {
  ready ??= (async () => {
    const q = rawSql();
    const have = new Set(((await q`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'campaigns'`) as { column_name: string }[]).map((r) => r.column_name));
    for (const [name, type] of COLUMNS) if (!have.has(name)) await q.query(`ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "${name}" ${type}`);
    if (!have.has("offer_status")) await q.query(`CREATE INDEX IF NOT EXISTS "campaigns_offer_status" ON "campaigns" ("offer_status")`);
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

/** SQL for what a campaign has spent so far, in cents: clicks × CPC when sold by the click, else views × CPM ÷ 1,000. */
export const SPEND_SQL = `(case when coalesce(c.cpc_cents, 0) > 0
  then (select count(*) from ad_events a where a.creative = 'campaign:' || c.id and a.kind = 'click') * c.cpc_cents
  else (select count(*) from ad_events a where a.creative = 'campaign:' || c.id and a.kind = 'impression') * c.cpm_cents / 1000.0 end)`;

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
export async function hashToken(token: string) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}
export function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
/** The advertiser's private link: the campaign id and its secret, together. */
export const refOf = (id: number, token: string) => `${id}-${token}`;
export function parseRef(ref: string): { id: number; token: string } | null {
  const m = /^(\d{1,12})-([A-Za-z0-9_-]{20,40})$/.exec(ref);
  return m ? { id: Number(m[1]), token: m[2] } : null;
}
export const manageUrl = (id: number, token: string) => `${SITE_URL}/advertise/c/${refOf(id, token)}`;

export type Offer = { by: "advertiser" | "wanlly"; cpmCents?: number; cpcCents?: number; note?: string; at: string };
export const priceText = (o: { cpmCents?: number; cpcCents?: number }) =>
  o.cpcCents ? `$${(o.cpcCents / 100).toFixed(2)} per click` : `$${((o.cpmCents ?? 0) / 100).toFixed(2)} per 1,000 views`;

function teamInbox(): string | null {
  const first = (process.env.OWNER_EMAILS ?? "").split(",")[0]?.trim();
  return process.env.ADS_EMAIL?.trim() || process.env.SUPPORT_EMAIL?.trim() || first || process.env.SMTP_USER?.trim() || null;
}

/** Emails the advertiser (with their private link) or the team. Never throws. */
export async function adMail(to: "team" | string, subject: string, heading: string, paragraphs: string[], button?: { label: string; url: string }) {
  if (to === "team") await alertTeam("offer", heading, paragraphs.map((p) => p.replace(/\*\*/g, "")), { link: button?.url, email: false });
  const address = to === "team" ? teamInbox() : to;
  if (!address || !mailReady()) return;
  const content = { preview: paragraphs[0]?.slice(0, 120) ?? heading, heading, paragraphs, button, signoff: to === "team" ? "Wanlly" : "The Wanlly ads team" };
  await sendMail({ to: address, subject, text: emailText(content), html: emailHtml(content, SITE_URL) }).catch((e) => console.error("ad email failed", e instanceof Error ? e.message : e));
}

/** Payment details shown once a price is agreed (ADVERTISER_PAYMENT_INFO in Cloudflare), or a default. */
export const paymentInfo = () =>
  process.env.ADVERTISER_PAYMENT_INFO?.trim() || "We'll email you an invoice with payment options (bank transfer, M-Pesa or card). Your campaign goes live as soon as payment arrives.";
