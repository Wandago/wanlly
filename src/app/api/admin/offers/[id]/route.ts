import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { CAN, logAction, requireStaff } from "@/lib/admin";
import { adMail, ensureCampaignColumns, hashToken, manageUrl, newToken, paymentInfo, priceText, type Offer } from "@/lib/ad-orders";
import { field, smallJson } from "@/lib/forms";

const c = schema.campaigns;

/**
 * The team's answer to a self-serve offer: accept the advertiser's price, counter with another,
 * decline, or confirm payment (which puts the campaign live). The advertiser is emailed a fresh
 * private link each time (the old one stops working, so only the latest email counts).
 */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/offers/[id]">) {
  const staff = await requireStaff(req, CAN.advertisers);
  if (staff instanceof Response) return staff;
  const id = Number((await ctx.params).id);
  const data = await smallJson(req);
  if (!Number.isSafeInteger(id) || !data) return Response.json({ error: "Bad request" }, { status: 400 });
  try {
    await ensureCampaignColumns();
    const d = db();
    const [row] = await d.select().from(c).where(eq(c.id, id)).limit(1);
    if (!row || row.source !== "self") return Response.json({ error: "Not found" }, { status: 404 });
    const offers = (row.offers as Offer[]) ?? [];
    const last = offers[offers.length - 1];
    const note = field(data, "note", 500) || undefined;
    const token = newToken();
    const link = manageUrl(row.id, token);
    const base = { tokenHash: await hashToken(token), updatedAt: sql`now()` };
    const action = String(data.action);
    let mail: [string, string, string[]] | null = null;

    if (action === "accept") {
      if (row.offerStatus !== "submitted" || last?.by !== "advertiser") return Response.json({ error: "There's no new offer to accept." }, { status: 409 });
      await d.update(c).set({ ...base, offerStatus: "accepted", cpmCents: last.cpmCents ?? 0, cpcCents: last.cpcCents ?? 0, offers: [...offers, { by: "wanlly", cpmCents: last.cpmCents, cpcCents: last.cpcCents, note: note ?? "Accepted", at: new Date().toISOString() }] }).where(eq(c.id, id));
      mail = [`Your Wanlly campaign price is agreed`, `${priceText(last)}: agreed`, [`Good news: we accept **${priceText(last)}** for "${row.headline}".`, paymentInfo(), ...(note ? [note] : [])]];
    } else if (action === "counter") {
      if (row.offerStatus === "accepted" || row.offerStatus === "declined") return Response.json({ error: "The price is already settled." }, { status: 409 });
      const byClick = !!(last?.cpcCents ?? row.cpcCents);
      const amount = Math.max(1, Math.min(byClick ? 10_000 : 100_000, Math.round(Number(byClick ? data.cpcCents : data.cpmCents)) || 0));
      const offer: Offer = { by: "wanlly", ...(byClick ? { cpcCents: amount } : { cpmCents: amount }), note, at: new Date().toISOString() };
      await d.update(c).set({ ...base, offerStatus: "countered", offers: [...offers, offer] }).where(eq(c.id, id));
      mail = [`A price for your Wanlly campaign`, `We suggest ${priceText(offer)}`, [`Thanks for your offer for "${row.headline}". We can run it at **${priceText(offer)}**.`, ...(note ? [note] : []), "Accept it, or offer another price, from your campaign page."]];
    } else if (action === "decline") {
      await d.update(c).set({ ...base, offerStatus: "declined", status: "ended", offers: [...offers, { by: "wanlly", note: note ?? "Declined", at: new Date().toISOString() }] }).where(eq(c.id, id));
      mail = [`About your Wanlly campaign`, `We can't run this campaign`, [`We're sorry: we can't run "${row.headline}".`, ...(note ? [note] : ["It may not fit our ad rules or our audience. Reply to this email if you'd like to talk it through."])]];
    } else if (action === "paid") {
      if (row.offerStatus !== "accepted") return Response.json({ error: "Agree a price before confirming payment." }, { status: 409 });
      // By the thousand, the budget buys a set number of views; by the click, spend is checked as clicks come in.
      const maxImpressions = row.cpcCents > 0 || !row.budgetCents || !row.cpmCents ? null : Math.floor((row.budgetCents / row.cpmCents) * 1000);
      await d.update(c).set({ ...base, paidAt: sql`now()`, status: "active", maxImpressions }).where(eq(c.id, id));
      mail = [`Your Wanlly campaign is live`, `You're live`, [`Payment received, thank you. "${row.headline}" is now showing on Wanlly.`, "Follow views, clicks and spend on your campaign page. You can pause it there any time."]];
    } else return Response.json({ error: "Unknown action." }, { status: 400 });

    if (row.email && mail) await adMail(row.email, mail[0], mail[1], mail[2], { label: "Open my campaign", url: link });
    await logAction(staff.id, `offer.${action}`, `campaign:${id}`, { cpmCents: data.cpmCents, cpcCents: data.cpcCents }).catch(() => {});
    return Response.json({ ok: true });
  } catch (e) {
    console.error("admin offer POST failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
