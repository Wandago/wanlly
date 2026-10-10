import { eq, sql } from "drizzle-orm";
import { db, rawSql, schema } from "@/db";
import { SPEND_SQL, adMail, ensureCampaignColumns, hashToken, parseRef, paymentInfo, priceText, type Offer } from "@/lib/ad-orders";
import { field, smallJson } from "@/lib/forms";
import { SITE_URL } from "@/lib/site";

const c = schema.campaigns;

/** The campaign behind a private link, or null when the link is wrong. */
async function find(ref: string) {
  const p = parseRef(ref);
  if (!p) return null;
  await ensureCampaignColumns();
  const [row] = await db().select().from(c).where(eq(c.id, p.id)).limit(1);
  if (!row || row.source !== "self" || !row.tokenHash || row.tokenHash !== (await hashToken(p.token))) return null;
  return row;
}

async function view(row: NonNullable<Awaited<ReturnType<typeof find>>>) {
  const [s] = (await rawSql().query(
    `select
       (select count(*) from ad_events a where a.creative = 'campaign:' || c.id and a.kind = 'impression')::int as impressions,
       (select count(*) from ad_events a where a.creative = 'campaign:' || c.id and a.kind = 'click')::int as clicks,
       ${SPEND_SQL}::float as spent
     from campaigns c where c.id = $1`,
    [row.id],
  )) as { impressions: number; clicks: number; spent: number }[];
  const daily = (await rawSql().query(
    `select to_char(d, 'YYYY-MM-DD') as day,
       (select count(*) from ad_events a where a.creative = $2 and a.kind = 'impression' and a.created_at >= d and a.created_at < d + interval '1 day')::int as impressions,
       (select count(*) from ad_events a where a.creative = $2 and a.kind = 'click' and a.created_at >= d and a.created_at < d + interval '1 day')::int as clicks
     from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') d order by d`,
    [row.id, `campaign:${row.id}`],
  )) as { day: string; impressions: number; clicks: number }[];
  return {
    campaign: {
      id: row.id,
      advertiser: row.advertiser,
      status: row.status,
      format: (row.placements as string[]).includes("suggested") ? "suggested" : "visual",
      headline: row.headline,
      body: row.body,
      cta: row.cta,
      url: row.url,
      color: row.color,
      hasImage: !!row.image,
      banners: Object.keys((row.banners as Record<string, string>) ?? {}),
      keywords: row.keywords,
      countries: row.countries,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      budgetCents: row.budgetCents,
      cpmCents: row.cpmCents,
      cpcCents: row.cpcCents,
      offerStatus: row.offerStatus,
      offers: row.offers,
      paid: !!row.paidAt,
      createdAt: row.createdAt,
    },
    stats: { impressions: s?.impressions ?? 0, clicks: s?.clicks ?? 0, spentCents: Math.round(s?.spent ?? 0), daily },
    payment: row.offerStatus === "accepted" && !row.paidAt ? paymentInfo() : null,
  };
}

export async function GET(_req: Request, ctx: RouteContext<"/api/advertise/campaigns/[ref]">) {
  try {
    const row = await find((await ctx.params).ref);
    if (!row) return Response.json({ error: "This link doesn't match a campaign. Check the link in your email." }, { status: 404 });
    return Response.json(await view(row));
  } catch (e) {
    console.error("advertiser campaign GET failed", e);
    return Response.json({ error: "We couldn't load your campaign just now." }, { status: 503 });
  }
}

/**
 * The advertiser's moves: accept Wanlly's price ({ action: "accept" }), offer another
 * ({ action: "offer", cpmCents | cpcCents, note }), or pause and resume a live campaign.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/advertise/campaigns/[ref]">) {
  try {
    const row = await find((await ctx.params).ref);
    if (!row) return Response.json({ error: "This link doesn't match a campaign." }, { status: 404 });
    const data = await smallJson(req);
    if (!data) return Response.json({ error: "Bad request" }, { status: 400 });
    const offers = (row.offers as Offer[]) ?? [];
    const last = offers[offers.length - 1];
    const d = db();
    const set = (v: Partial<typeof c.$inferInsert>) => d.update(c).set({ ...v, updatedAt: sql`now()` }).where(eq(c.id, row.id));
    if (data.action === "accept") {
      if (row.offerStatus !== "countered" || last?.by !== "wanlly") return Response.json({ error: "There's no price from us to accept right now." }, { status: 409 });
      await set({ offerStatus: "accepted", cpmCents: last.cpmCents ?? 0, cpcCents: last.cpcCents ?? 0, offers: [...offers, { by: "advertiser", ...(last.cpcCents ? { cpcCents: last.cpcCents } : { cpmCents: last.cpmCents }), note: "Accepted", at: new Date().toISOString() }] });
      await adMail("team", `[Wanlly ads] ${row.advertiser} accepted ${priceText(last)}`, `Price agreed for #${row.id}`, [`**${row.advertiser}** accepted **${priceText(last)}**. Confirm their payment in Admin to put it live.`], { label: "Open Admin", url: `${SITE_URL}/admin#advertisers` });
    } else if (data.action === "offer") {
      if (row.offerStatus === "accepted" || row.offerStatus === "declined") return Response.json({ error: "The price is already settled." }, { status: 409 });
      const byClick = !!(last?.cpcCents ?? row.cpcCents);
      const amount = Math.max(0, Math.min(byClick ? 10_000 : 100_000, Math.round(Number(byClick ? data.cpcCents : data.cpmCents)) || 0));
      if (!amount) return Response.json({ error: "Offer a price above zero." }, { status: 422 });
      const offer: Offer = { by: "advertiser", ...(byClick ? { cpcCents: amount } : { cpmCents: amount }), note: field(data, "note", 500) || undefined, at: new Date().toISOString() };
      await set({ offerStatus: "submitted", offers: [...offers, offer] });
      await adMail("team", `[Wanlly ads] New price from ${row.advertiser}: ${priceText(offer)}`, `New offer on #${row.id}`, [`**${row.advertiser}** offers **${priceText(offer)}**.`, ...(offer.note ? [`Note: ${offer.note}`] : [])], { label: "Review in Admin", url: `${SITE_URL}/admin#advertisers` });
    } else if (data.action === "pause" || data.action === "resume") {
      if (!row.paidAt || (row.status !== "active" && row.status !== "paused")) return Response.json({ error: "Only a live campaign can be paused." }, { status: 409 });
      await set({ status: data.action === "pause" ? "paused" : "active" });
    } else return Response.json({ error: "Unknown action." }, { status: 400 });
    const fresh = await find((await ctx.params).ref);
    return Response.json(await view(fresh!));
  } catch (e) {
    console.error("advertiser campaign POST failed", e);
    return Response.json({ error: "That didn't save. Try again in a minute." }, { status: 503 });
  }
}
