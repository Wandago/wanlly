import { db, schema } from "@/db";
import { CATEGORIES, FORMATS } from "@/lib/campaigns";
import { field, isEmail, smallJson } from "@/lib/forms";

/** Saves an application to advertise. Public; bots are turned away by a hidden field. */
export async function POST(req: Request) {
  const data = await smallJson(req);
  if (!data) return Response.json({ error: "Bad request" }, { status: 400 });
  if (field(data, "website2", 200)) return Response.json({ ok: true });
  const company = field(data, "company", 120);
  const contactName = field(data, "name", 120);
  const email = field(data, "email", 254).toLowerCase();
  const category = field(data, "category", 60);
  if (!company || !contactName || !isEmail(email) || !category) return Response.json({ error: "Please fill in your company, name, a valid email and what you sell." }, { status: 422 });
  const formats = Array.isArray(data.formats) ? FORMATS.filter((f) => (data.formats as unknown[]).includes(f)) : [];
  try {
    await db()
      .insert(schema.advertiserApplications)
      .values({
        company,
        contactName,
        email,
        website: field(data, "website", 300) || null,
        country: field(data, "country", 80) || null,
        category: (CATEGORIES as readonly string[]).includes(category) ? category : `Other: ${category}`,
        budget: field(data, "budget", 60) || null,
        formats,
        message: field(data, "message", 2000),
        networkCountry: req.headers.get("cf-ipcountry"),
      });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("advertise failed", e);
    return Response.json({ error: "We couldn't save that just now. Please try again in a minute." }, { status: 503 });
  }
}
