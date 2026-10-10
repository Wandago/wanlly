import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { adMail, ensureCampaignColumns, hashToken, manageUrl, newToken } from "@/lib/ad-orders";
import { field, isEmail, smallJson } from "@/lib/forms";

const c = schema.campaigns;

/** Lost link: emails fresh private links for every campaign under this address. Always answers the same way. */
export async function POST(req: Request) {
  const data = await smallJson(req);
  const email = data ? field(data, "email", 254).toLowerCase() : "";
  if (!isEmail(email)) return Response.json({ error: "Enter the email you used." }, { status: 422 });
  try {
    await ensureCampaignColumns();
    const d = db();
    const rows = await d.select({ id: c.id, headline: c.headline }).from(c).where(and(eq(c.email, email), eq(c.source, "self"))).limit(20);
    if (rows.length) {
      const links: string[] = [];
      for (const r of rows) {
        const token = newToken();
        await d.update(c).set({ tokenHash: await hashToken(token) }).where(eq(c.id, r.id));
        links.push(`"${r.headline}": ${manageUrl(r.id, token)}`);
      }
      await adMail(email, "Your Wanlly campaign links", "Your campaign links", ["Here are fresh links to your campaigns. Older links no longer work.", ...links]);
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error("advertise resend failed", e);
    return Response.json({ error: "Try again in a minute." }, { status: 503 });
  }
}
