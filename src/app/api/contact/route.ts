import { db, schema } from "@/db";
import { field, isEmail, smallJson } from "@/lib/forms";

const TOPICS = ["General", "Advertise on Wanlly", "Partnerships", "Press", "Support", "Privacy"];

/** Saves a contact message. Public; same bot protections as the beta form. */
export async function POST(req: Request) {
  const data = await smallJson(req);
  if (!data) return Response.json({ error: "Bad request" }, { status: 400 });
  if (field(data, "website", 200)) return Response.json({ ok: true });

  const name = field(data, "name", 120);
  const email = field(data, "email", 254).toLowerCase();
  const message = field(data, "message", 4000);
  const topic = TOPICS.includes(field(data, "topic", 40)) ? field(data, "topic", 40) : "General";
  if (!name || !isEmail(email) || message.length < 5) return Response.json({ error: "Please add your name, a valid email and a message." }, { status: 422 });
  try {
    await db().insert(schema.contactMessages).values({ name, email, topic, message, networkCountry: req.headers.get("cf-ipcountry") });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("contact failed", e);
    return Response.json({ error: "We couldn't send that just now. Please try again in a minute." }, { status: 503 });
  }
}
