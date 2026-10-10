import { rawSql } from "@/db";
import { CAN, requireStaff } from "@/lib/admin";
import { SPEND_SQL, ensureCampaignColumns } from "@/lib/ad-orders";

/** Self-serve campaigns with their price talks and spend, newest activity first. */
export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.advertisers);
  if (staff instanceof Response) return staff;
  try {
    await ensureCampaignColumns();
    const rows = (await rawSql().query(
      `select c.id, c.advertiser, c.email, c.name, c.status, c.headline, c.body, c.cta, c.url, c.color, (c.image is not null) as has_image,
         c.placements, c.keywords, c.countries, c.starts_at, c.ends_at, c.budget_cents, c.cpm_cents, c.cpc_cents,
         c.offer_status, c.offers, c.paid_at, c.created_at, c.updated_at,
         (select count(*) from ad_events a where a.creative = 'campaign:' || c.id and a.kind = 'impression')::int as impressions,
         (select count(*) from ad_events a where a.creative = 'campaign:' || c.id and a.kind = 'click')::int as clicks,
         ${SPEND_SQL}::float as spent
       from campaigns c where c.source = 'self'
       order by (c.offer_status = 'submitted') desc, (c.offer_status = 'accepted' and c.paid_at is null) desc, c.updated_at desc limit 200`,
    )) as Record<string, unknown>[];
    return Response.json({
      offers: rows.map((r) => ({
        id: Number(r.id),
        advertiser: r.advertiser,
        email: r.email,
        status: r.status,
        format: (r.placements as string[]).includes("suggested") ? "suggested" : "visual",
        headline: r.headline,
        body: r.body,
        cta: r.cta,
        url: r.url,
        color: r.color,
        image: r.has_image ? `/api/ads/image/${r.id}` : null,
        keywords: r.keywords,
        countries: r.countries,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        budgetCents: r.budget_cents === null ? null : Number(r.budget_cents),
        cpmCents: Number(r.cpm_cents),
        cpcCents: Number(r.cpc_cents),
        offerStatus: r.offer_status,
        offers: r.offers,
        paid: !!r.paid_at,
        impressions: Number(r.impressions),
        clicks: Number(r.clicks),
        spentCents: Math.round(Number(r.spent)),
        createdAt: r.created_at,
      })),
    });
  } catch (e) {
    console.error("admin offers GET failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
