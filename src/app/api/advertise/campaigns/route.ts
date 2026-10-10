import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { GUIDE, SUGGESTED_PLACEMENTS, VISUAL_PLACEMENTS, adMail, ensureCampaignColumns, hashToken, manageUrl, newToken, priceText, type Offer } from "@/lib/ad-orders";
import { campaignFields } from "@/lib/campaigns";
import { field, isEmail, jsonUpTo } from "@/lib/forms";
import { SITE_URL } from "@/lib/site";

const c = schema.campaigns;
const cents = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.round(Number(v)) || 0));

/**
 * An advertiser's new campaign: the ad, where it shows, the budget and the price they offer. It
 * waits for the team; the advertiser gets a private link to follow it. Public, no account needed.
 */
export async function POST(req: Request) {
  const data = await jsonUpTo(req, 2_600_000);
  if (!data) return Response.json({ error: "That's too big. Keep each picture under 200 KB." }, { status: 413 });
  if (field(data, "website2", 200)) return Response.json({ ok: true });
  const company = field(data, "company", 80);
  const email = field(data, "email", 254).toLowerCase();
  const format = data.format === "suggested" ? "suggested" : "visual";
  if (!company || !isEmail(email)) return Response.json({ error: "Add your company name and a valid email." }, { status: 422 });
  const parsed = campaignFields({
    headline: data.headline,
    body: data.body,
    cta: data.cta || "Learn more",
    url: data.url,
    color: data.color || "#2a78d6",
    image: data.image ?? null,
    banners: format === "visual" ? (data.banners ?? {}) : {},
    countries: Array.isArray(data.countries) ? data.countries : [],
    startsAt: data.startsAt || null,
    endsAt: data.endsAt || null,
  });
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 422 });
  const ad = parsed.ok;
  if (!ad.headline || ad.headline.length < 4) return Response.json({ error: "Write a headline for your ad." }, { status: 422 });
  if (!ad.url) return Response.json({ error: "Add the https:// link your ad opens." }, { status: 422 });
  const keywords = Array.isArray(data.keywords)
    ? [...new Set((data.keywords as unknown[]).map((k) => String(k).toLowerCase().trim().slice(0, 40)).filter((k) => k.length >= 2))].slice(0, 25)
    : [];
  if (format === "suggested" && keywords.length < 2) return Response.json({ error: "Add at least two topics for your suggested ad to match." }, { status: 422 });
  const budgetCents = cents(data.budgetCents, 10_000_000);
  if (budgetCents < GUIDE.minBudget) return Response.json({ error: `The smallest budget is $${GUIDE.minBudget / 100}.` }, { status: 422 });
  const byClick = format === "suggested" && data.pricing === "cpc";
  const offer: Offer = {
    by: "advertiser",
    ...(byClick ? { cpcCents: cents(data.cpcCents, 10_000) } : { cpmCents: cents(data.cpmCents, 100_000) }),
    note: field(data, "note", 500) || undefined,
    at: new Date().toISOString(),
  };
  if (!(offer.cpcCents || offer.cpmCents)) return Response.json({ error: "Offer a price above zero." }, { status: 422 });
  const category = field(data, "category", 60);
  try {
    await ensureCampaignColumns();
    const d = db();
    const [{ n }] = await d
      .select({ n: sql<number>`count(*)::int` })
      .from(c)
      .where(and(eq(c.email, email), gte(c.createdAt, sql`now() - interval '1 day'`)));
    if (n >= 6) return Response.json({ error: "You've sent several campaigns today. Follow them from the links we emailed you." }, { status: 429 });
    const token = newToken();
    const [row] = await d
      .insert(c)
      .values({
        advertiser: company,
        name: `${format === "suggested" ? "Suggested" : "Visual"} · ${ad.headline!.slice(0, 50)}`,
        status: "draft",
        headline: ad.headline!,
        body: ad.body ?? "",
        cta: ad.cta || "Learn more",
        url: ad.url!,
        color: ad.color ?? "#2a78d6",
        image: ad.image ?? null,
        banners: ad.banners ?? {},
        placements: format === "suggested" ? SUGGESTED_PLACEMENTS : VISUAL_PLACEMENTS,
        countries: ad.countries ?? [],
        startsAt: ad.startsAt ?? null,
        endsAt: ad.endsAt ?? null,
        frequencyCap: format === "suggested" ? 3 : 6,
        keywords,
        budgetCents,
        source: "self",
        email,
        tokenHash: await hashToken(token),
        offerStatus: "submitted",
        offers: [offer],
      })
      .returning({ id: c.id });
    const link = manageUrl(row.id, token);
    await adMail(email, "Your Wanlly campaign is in review", "We've got your campaign", [
      `Thanks, ${company}. Your ${format === "suggested" ? "suggested" : "visual"} ad and your offer of **${priceText(offer)}** with a **$${(budgetCents / 100).toFixed(2)}** budget are with our team.`,
      "We usually reply within a working day: we accept the price, or suggest another. Follow it, answer and see your results at this private link. Keep it to yourself: anyone with it can manage the campaign.",
    ], { label: "Open my campaign", url: link });
    await adMail("team", `[Wanlly ads] New offer from ${company}: ${priceText(offer)}`, `New self-serve campaign #${row.id}`, [
      `**${company}** (${email})${category ? ` · ${category}` : ""}`,
      `${format === "suggested" ? "Suggested ad" : "Visual ad"}: "${ad.headline}"`,
      `Offer: **${priceText(offer)}**, budget $${(budgetCents / 100).toFixed(2)}${keywords.length ? `, topics: ${keywords.join(", ")}` : ""}`,
      ...(offer.note ? [`Note: ${offer.note}`] : []),
    ], { label: "Review in Admin", url: `${SITE_URL}/admin#advertisers` });
    return Response.json({ id: row.id, ref: `${row.id}-${token}` });
  } catch (e) {
    console.error("self-serve campaign failed", e);
    return Response.json({ error: "We couldn't save that just now. Please try again in a minute." }, { status: 503 });
  }
}
