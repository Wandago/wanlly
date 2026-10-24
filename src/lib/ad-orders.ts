import "server-only";
import { rawSql } from "@/db";
import { alertTeam } from "./alerts";
import { emailHtml, emailText } from "./email-layout";
import { mailReady, sendMail } from "./mail";
import { SITE_URL } from "./site";
import { ensureVideoAds } from "./video-ads";

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
    await seedHouseCampaigns();
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

/**
 * Wanlly's own campaigns shipped with the site, added once (an app_flags marker), live, at no
 * charge: their banners are animated GIFs in public/ads, so nothing big sits in the database.
 * After that they're ordinary campaigns: pause, edit or delete them in Admin and it sticks.
 */
async function seedHouseCampaigns() {
  await rawSql()`with mark as (
      insert into app_flags (key, value) values ('campaignSeed:sign', 'true'::jsonb) on conflict do nothing returning key
    )
    insert into campaigns (advertiser, name, status, headline, body, cta, url, color, image, banners, placements, countries, cpm_cents)
    select 'Wanlly Sign', 'Wanlly Sign · launch', 'active', 'Get it signed today.',
      'Electronic signatures made for Africa. People sign from any phone, no account needed.', 'Start free',
      'https://sign.wanlly.africa/sign-up', '#ff5a1f', '/ads/sign/wanlly-sign-300x250.gif',
      ${BANNERS}::jsonb, ${JSON.stringify(VISUAL_PLACEMENTS)}::jsonb, '[]'::jsonb, 0
    where exists (select 1 from mark)`;
  await rawSql()`with mark as (
      insert into app_flags (key, value) values ('campaignSeed:wanlly', 'true'::jsonb) on conflict do nothing returning key
    )
    insert into campaigns (advertiser, name, status, headline, body, cta, url, color, image, banners, placements, countries, cpm_cents)
    select 'Wanlly', 'Wanlly AI · invite', 'active', 'Top AI models. Free.',
      'Chat, code and design with the world''s top AI models, paid for by sponsors. Tell a friend.', 'Start free',
      'https://wanlly.africa', '#ff5a1f', '/ads/wanlly/wanlly-ai-300x250.gif',
      ${WANLLY_BANNERS}::jsonb, ${JSON.stringify(VISUAL_PLACEMENTS)}::jsonb, '[]'::jsonb, 0
    where exists (select 1 from mark)`;
  await seedTumaCv().catch((e) => console.error("TumaCV seed failed", e instanceof Error ? e.message : e));
}

/**
 * TumaCV's banners (GIFs in public/ads/tumacv) go on its existing campaign, keeping any size it
 * already has; with no campaign yet, one is made from the TumaCV offer's link. Its video ads get
 * the same link. Once only.
 */
async function seedTumaCv() {
  const q = rawSql();
  const [mark] = (await q`insert into app_flags (key, value) values ('campaignSeed:tumacv', 'true'::jsonb) on conflict do nothing returning key`) as { key: string }[];
  if (!mark) return;
  const [c] = (await q`select id, url from campaigns where advertiser ilike 'tuma%' and status <> 'ended' order by id desc limit 1`) as { id: number; url: string }[];
  let url = c?.url ?? "";
  if (!url) {
    const [f] = (await q`select value from app_flags where key = 'affiliates'`) as { value: unknown }[];
    const offers = Array.isArray(f?.value) ? (f.value as { name?: string; url?: string }[]) : [];
    url = offers.find((o) => /tuma/i.test(o.name ?? "") && /^https:\/\//.test(o.url ?? ""))?.url ?? "";
  }
  if (c) await q`update campaigns set banners = ${TUMA_BANNERS}::jsonb || coalesce(banners, '{}'::jsonb), updated_at = now() where id = ${c.id}`;
  else if (url)
    await q`insert into campaigns (advertiser, name, status, headline, body, cta, url, color, image, banners, placements, countries, cpm_cents)
      values ('Tuma CV', 'Tuma CV · tailored CVs', 'active', 'Same CV for every job?', 'A tailored CV and cover letter for each job, in minutes. 5 free applications.',
        'Try it free', ${url}, '#16a34a', '/ads/tumacv/tumacv-300x250.gif', ${TUMA_BANNERS}::jsonb, ${JSON.stringify(VISUAL_PLACEMENTS)}::jsonb, '[]'::jsonb, 0)`;
  if (url) {
    await ensureVideoAds();
    await q`update video_ads set link = ${url} where url like '/ads/tumacv-%' and link = ''`;
  }
}
const WANLLY_BANNERS = JSON.stringify({"300x600": "/ads/wanlly/wanlly-ai-300x600.gif", "160x600": "/ads/wanlly/wanlly-ai-160x600.gif", "336x280": "/ads/wanlly/wanlly-ai-336x280.gif", "300x250": "/ads/wanlly/wanlly-ai-300x250.gif", "728x90": "/ads/wanlly/wanlly-ai-728x90.gif", "468x60": "/ads/wanlly/wanlly-ai-468x60.gif", "320x100": "/ads/wanlly/wanlly-ai-320x100.gif", "320x50": "/ads/wanlly/wanlly-ai-320x50.gif"});
const TUMA_BANNERS = JSON.stringify({"300x600": "/ads/tumacv/tumacv-300x600.gif", "160x600": "/ads/tumacv/tumacv-160x600.gif", "336x280": "/ads/tumacv/tumacv-336x280.gif", "300x250": "/ads/tumacv/tumacv-300x250.gif", "728x90": "/ads/tumacv/tumacv-728x90.gif", "468x60": "/ads/tumacv/tumacv-468x60.gif", "320x100": "/ads/tumacv/tumacv-320x100.gif", "320x50": "/ads/tumacv/tumacv-320x50.gif"});
const BANNERS = JSON.stringify({"300x600": "/ads/sign/wanlly-sign-300x600.gif", "160x600": "/ads/sign/wanlly-sign-160x600.gif", "336x280": "/ads/sign/wanlly-sign-336x280.gif", "300x250": "/ads/sign/wanlly-sign-300x250.gif", "728x90": "/ads/sign/wanlly-sign-728x90.gif", "468x60": "/ads/sign/wanlly-sign-468x60.gif", "320x100": "/ads/sign/wanlly-sign-320x100.gif", "320x50": "/ads/sign/wanlly-sign-320x50.gif"});

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
