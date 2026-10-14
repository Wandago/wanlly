import { after } from "next/server";
import { alertTeam } from "@/lib/alerts";
import { autoReply, ensureMessageColumns } from "@/lib/auto-reply";
import { rawSql } from "@/db";
import { SITE_URL } from "@/lib/site";
import { db, schema } from "@/db";
import { field, isEmail, smallJson } from "@/lib/forms";
import { SAY } from "@/lib/messages";

const TOPICS = ["General", "Advertise on Wanlly", "Partnerships", "Press", "Support", "Privacy"];

/** Saves a contact message. Public; same bot protections as the beta form. */
export async function POST(req: Request) {
  const data = await smallJson(req);
  if (!data) return Response.json({ error: SAY.badRequest }, { status: 400 });
  if (field(data, "website", 200)) return Response.json({ ok: true });

  const name = field(data, "name", 120);
  const email = field(data, "email", 254).toLowerCase();
  const message = field(data, "message", 4000);
  const topic = TOPICS.includes(field(data, "topic", 40)) ? field(data, "topic", 40) : "General";
  if (!name || !isEmail(email) || message.length < 5) return Response.json({ error: "Please add your name, a valid email and a message." }, { status: 422 });
  try {
    const [row] = await db().insert(schema.contactMessages).values({ name, email, topic, message, networkCountry: req.headers.get("cf-ipcountry") }).returning({ id: schema.contactMessages.id });
    // The instant reply (when switched on) goes out after the response, and is kept for Admin.
    after(async () => {
      const sent = await autoReply({ to: email, name, topic, question: message });
      if (sent === null) return;
      await ensureMessageColumns();
      await rawSql()`update contact_messages set auto_reply = ${sent || "(acknowledgement only)"} where id = ${row.id}`;
    });
    await alertTeam("contact", `${name} · ${topic}`, [email, message.slice(0, 1200)], { link: `${SITE_URL}/admin#messages` });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("contact failed", e);
    return Response.json({ error: "We couldn't send that just now. Please try again in a minute." }, { status: 503 });
  }
}
