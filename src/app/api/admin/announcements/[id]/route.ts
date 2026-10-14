import { eq } from "drizzle-orm";
import { db, rawSql, schema } from "@/db";
import { CAN, logAction, requireStaff } from "@/lib/admin";
import { getAnnouncement, renderAnnouncement, sendAnnouncementBatch } from "@/lib/announcements";
import { mailReady, sendMail } from "@/lib/mail";
import { smallJson } from "@/lib/forms";

/**
 * One announcement: "test" emails it to you, "start" begins sending (hourly batches),
 * "batch" sends the next batch now, "pause" stops, "delete" removes a draft.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/announcements/[id]">) {
  const staff = await requireStaff(req, CAN.beta);
  if (staff instanceof Response) return staff;
  const id = Number((await ctx.params).id);
  const action = String((await smallJson(req))?.action ?? "");
  const a = Number.isSafeInteger(id) ? await getAnnouncement(id) : null;
  if (!a) return Response.json({ error: "Not found" }, { status: 404 });
  if (action === "test") {
    if (!mailReady()) return Response.json({ error: "Email isn't set up: add SMTP_USER and SMTP_PASS in Cloudflare." }, { status: 503 });
    const [me] = await db().select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, staff.id)).limit(1);
    if (!me?.email) return Response.json({ error: "Your account has no email." }, { status: 400 });
    const m = renderAnnouncement(a, me.email);
    await sendMail({ to: me.email, subject: `[Test] ${m.subject}`, text: m.text, html: m.html });
    return Response.json({ ok: true, note: `Test sent to ${me.email}.` });
  }
  // Emailing everyone is for owners and admins; support staff can draft and test.
  if ((action === "start" || action === "batch") && !(CAN.switches as readonly string[]).includes(staff.role)) return Response.json({ error: "Only owners and admins can send announcements." }, { status: 403 });
  if (action === "start" || action === "pause") {
    if (a.status === "sent") return Response.json({ error: "It's already been sent." }, { status: 400 });
    await rawSql()`update announcements set status = ${action === "start" ? "sending" : "paused"} where id = ${id}`;
    await logAction(staff.id, `announcement.${action}`, `announcement:${id}`, { subject: a.subject, audience: a.audience });
    if (action === "start") return Response.json({ ok: true, ...(await sendAnnouncementBatch(id)) });
    return Response.json({ ok: true });
  }
  if (action === "batch") return Response.json({ ok: true, ...(await sendAnnouncementBatch(id)) });
  if (action === "delete") {
    if (a.status !== "draft") return Response.json({ error: "Only drafts can be deleted; pause it instead." }, { status: 400 });
    await rawSql()`delete from announcements where id = ${id}`;
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
