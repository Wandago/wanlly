import { db, schema } from "@/db";
import { channelOf, cleanFirstTouch } from "@/lib/first-touch";
import { field, isEmail, smallJson } from "@/lib/forms";
import { SAY } from "@/lib/messages";

/** Saves a beta application. Public; bots are turned away by a hidden field and size limits. */
export async function POST(req: Request) {
  const data = await smallJson(req);
  if (!data) return Response.json({ error: SAY.badRequest }, { status: 400 });
  // Honeypot: people never see this field, simple bots fill it in.
  if (field(data, "website", 200)) return Response.json({ ok: true, code: "thanks" });

  const name = field(data, "name", 120);
  const email = field(data, "email", 254).toLowerCase();
  const build = field(data, "build", 2000);
  if (!name || !isEmail(email) || build.length < 3) return Response.json({ error: "Please fill in your name, a valid email and what you want to build." }, { status: 422 });

  const first = name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "").slice(0, 8) || "friend";
  const inviteCode = `${first}-${crypto.randomUUID().slice(0, 6)}`;
  const firstTouch = cleanFirstTouch((data as Record<string, unknown>).firstTouch);
  const referralCode = field(data, "ref", 40) || null;
  const values = {
    name,
    email,
    build,
    country: field(data, "country", 80) || null,
    source: field(data, "source", 120) || null,
    referralCode,
    inviteCode,
    networkCountry: req.headers.get("cf-ipcountry"),
  };
  const save = (v: typeof schema.betaApplications.$inferInsert) =>
    db()
      .insert(schema.betaApplications)
      .values(v)
      .onConflictDoUpdate({ target: schema.betaApplications.email, set: { build, name } })
      .returning({ inviteCode: schema.betaApplications.inviteCode });
  try {
    let rows;
    try {
      rows = await save({ ...values, firstTouch, channel: channelOf(firstTouch, !!referralCode) });
    } catch (e) {
      // Until migration 0008 has run, save the application without where it came from.
      if (!/first_touch|channel/.test(`${e} ${(e as { cause?: unknown }).cause}`)) throw e;
      rows = await save(values);
    }
    return Response.json({ ok: true, code: rows[0].inviteCode });
  } catch (e) {
    console.error("beta application failed", e);
    return Response.json({ error: "We couldn't save that just now. Please try again in a minute." }, { status: 503 });
  }
}
