import { db, rawSql, schema } from "@/db";
import { CAN, logAction, requireStaff } from "@/lib/admin";
import { campaignFields, needsMigration } from "@/lib/campaigns";
import { jsonUpTo } from "@/lib/forms";

/** Every campaign with its delivery so far: impressions, clicks and what it has earned. */
export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.advertisers);
  if (staff instanceof Response) return staff;
  try {
    const q = rawSql();
    const rows = (await q`
      select c.id, c.application_id, c.advertiser, c.name, c.status, c.headline, c.body, c.cta, c.url, c.color, c.cover,
        c.image, c.placements, c.countries, c.starts_at, c.ends_at, c.max_impressions, c.cpm_cents, c.created_at,
        (to_jsonb(c)->>'frequency_cap')::int as frequency_cap,
        coalesce(e.impressions, 0)::int as impressions, coalesce(e.clicks, 0)::int as clicks
      from campaigns c
      left join (
        select creative, count(*) filter (where kind = 'impression') as impressions, count(*) filter (where kind = 'click') as clicks
        from ad_events where creative like 'campaign:%' group by creative
      ) e on e.creative = 'campaign:' || c.id
      order by (c.status = 'active') desc, c.id desc limit 200`) as Record<string, unknown>[];
    return Response.json({
      campaigns: rows.map((r) => ({
        id: Number(r.id),
        applicationId: r.application_id === null ? null : Number(r.application_id),
        advertiser: r.advertiser,
        name: r.name,
        status: r.status,
        headline: r.headline,
        body: r.body,
        cta: r.cta,
        url: r.url,
        color: r.color,
        cover: r.cover,
        image: r.image,
        placements: r.placements,
        countries: r.countries,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        maxImpressions: r.max_impressions === null ? null : Number(r.max_impressions),
        frequencyCap: r.frequency_cap === null ? null : Number(r.frequency_cap),
        cpmCents: Number(r.cpm_cents),
        impressions: Number(r.impressions),
        clicks: Number(r.clicks),
        earned: (Number(r.impressions) / 1000) * (Number(r.cpm_cents) / 100),
      })),
    });
  } catch (e) {
    console.error("admin campaigns GET failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const staff = await requireStaff(req, CAN.advertisers);
  if (staff instanceof Response) return staff;
  const data = await jsonUpTo(req, 320_000);
  if (!data) return Response.json({ error: "Bad request" }, { status: 400 });
  const r = campaignFields(data);
  if ("error" in r) return Response.json({ error: r.error }, { status: 422 });
  const f = r.ok;
  if (!f.advertiser || !f.name || !f.headline || !f.url) return Response.json({ error: "Add the advertiser, a campaign name, a headline and a link." }, { status: 422 });
  try {
    const c = schema.campaigns;
    const [row] = await db()
      .insert(c)
      .values({ ...f, advertiser: f.advertiser, name: f.name, headline: f.headline, url: f.url, status: f.status ?? "draft" })
      .returning({ id: c.id });
    await logAction(staff.id, "campaign.created", `campaign:${row.id}`, { advertiser: f.advertiser, name: f.name });
    return Response.json({ id: row.id });
  } catch (e) {
    console.error("admin campaign POST failed", e);
    return Response.json({ error: needsMigration(e) ?? "Database unavailable" }, { status: 503 });
  }
}
