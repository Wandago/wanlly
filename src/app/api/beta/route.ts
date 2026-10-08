import { db, schema } from "@/db";
import { field, isEmail, smallJson } from "@/lib/forms";

/** Saves a beta application. Public; bots are turned away by a hidden field and size limits. */
export async function POST(req: Request) {
  const data = await smallJson(req);
  if (!data) return Response.json({ error: "Bad request" }, { status: 400 });
  // Honeypot: people never see this field, simple bots fill it in.
  if (field(data, "website", 200)) return Response.json({ ok: true, code: "thanks" });

  const name = field(data, "name", 120);
  const email = field(data, "email", 254).toLowerCase();
  const build = field(data, "build", 2000);
  if (!name || !isEmail(email) || build.length < 3) return Response.json({ error: "Please fill in your name, a valid email and what you want to build." }, { status: 422 });

  const first = name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "").slice(0, 8) || "friend";
  const inviteCode = `${first}-${crypto.randomUUID().slice(0, 6)}`;
  try {
    const [row] = await db()
      .insert(schema.betaApplications)
      .values({
        name,
        email,
        build,
        country: field(data, "country", 80) || null,
        source: field(data, "source", 120) || null,
        referralCode: field(data, "ref", 40) || null,
        inviteCode,
        networkCountry: req.headers.get("cf-ipcountry"),
      })
      .onConflictDoUpdate({ target: schema.betaApplications.email, set: { build, name } })
      .returning({ inviteCode: schema.betaApplications.inviteCode });
    return Response.json({ ok: true, code: row.inviteCode });
  } catch (e) {
    console.error("beta application failed", e);
    return Response.json({ error: "We couldn't save that just now. Please try again in a minute." }, { status: 503 });
  }
}
