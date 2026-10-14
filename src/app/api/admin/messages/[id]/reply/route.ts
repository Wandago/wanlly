import { eq } from "drizzle-orm";
import { db, rawSql, schema } from "@/db";
import { CAN, logAction, requireStaff } from "@/lib/admin";
import { ensureMessageColumns } from "@/lib/auto-reply";
import { field, smallJson } from "@/lib/forms";
import { mailReady, sendMail } from "@/lib/mail";

/** Emails the team's reply to a contact message from Wanlly's mailbox, and marks it handled. */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/messages/[id]/reply">) {
  const staff = await requireStaff(req, CAN.messages);
  if (staff instanceof Response) return staff;
  const id = Number((await ctx.params).id);
  const data = await smallJson(req);
  const text = data ? field(data, "text", 8000) : "";
  if (!Number.isSafeInteger(id) || text.length < 2) return Response.json({ error: "Write a reply first." }, { status: 400 });
  if (!mailReady()) return Response.json({ error: "Email isn't set up: add SMTP_USER and SMTP_PASS in Cloudflare." }, { status: 503 });
  const [m] = await db().select().from(schema.contactMessages).where(eq(schema.contactMessages.id, id)).limit(1);
  if (!m) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const quoted = m.message.split("\n").map((l) => `> ${l}`).join("\n");
    await sendMail({ to: m.email, subject: `Re: your message to Wanlly (${m.topic})`, text: `${text}\n\n${quoted}` });
    await ensureMessageColumns();
    await rawSql()`update contact_messages set reply = ${text}, replied_at = now(), handled_at = coalesce(handled_at, now()) where id = ${id}`;
    await logAction(staff.id, "message.replied", `message:${id}`);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("message reply failed", e);
    return Response.json({ error: "Couldn't send that. Try again in a minute." }, { status: 503 });
  }
}
