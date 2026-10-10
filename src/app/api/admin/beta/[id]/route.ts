import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { CAN, logAction, requireStaff } from "@/lib/admin";
import { inviteMessage } from "@/lib/beta-invite";
import { smallJson } from "@/lib/forms";
import { mailReady, sendMail } from "@/lib/mail";
import { SITE_URL } from "@/lib/site";

const b = schema.betaApplications;
const STATUSES = ["pending", "approved", "declined"] as const;

/** Emails the invite from Wanlly's mailbox. "skipped" when email isn't set up. */
async function emailInvite(row: { id: number; name: string; email: string }, staffId: string): Promise<"sent" | "failed" | "skipped"> {
  if (!mailReady()) return "skipped";
  try {
    await sendMail({ to: row.email, ...inviteMessage(row, SITE_URL) });
  } catch (e) {
    console.error("beta invite email failed", e instanceof Error ? e.message : e);
    return "failed";
  }
  await logAction(staffId, "beta.invite_sent", `beta:${row.id}`, { email: row.email }).catch(() => {});
  return "sent";
}

/** Approve, decline, or move an application back to pending. Approving emails the invite. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/beta/[id]">) {
  const staff = await requireStaff(req, CAN.beta);
  if (staff instanceof Response) return staff;
  const id = Number((await ctx.params).id);
  const data = await smallJson(req);
  const status = STATUSES.find((s) => s === data?.status);
  if (!Number.isSafeInteger(id) || id <= 0 || !status) return Response.json({ error: "Bad request" }, { status: 400 });
  try {
    const [before] = await db().select({ status: b.status }).from(b).where(eq(b.id, id)).limit(1);
    const [row] = await db()
      .update(b)
      .set({ status, reviewedAt: status === "pending" ? null : sql`now()`, reviewedBy: status === "pending" ? null : staff.id })
      .where(eq(b.id, id))
      .returning();
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    await logAction(staff.id, `beta.${status}`, `beta:${id}`, { email: row.email });
    // Only on the move to approved, so pressing Approve twice doesn't send two emails.
    const invite = status === "approved" && before?.status !== "approved" ? await emailInvite(row, staff.id) : undefined;
    return Response.json({ application: row, invite });
  } catch (e) {
    console.error("admin beta PATCH failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}

/** Sends the invite again, for an approved application. */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/beta/[id]">) {
  const staff = await requireStaff(req, CAN.beta);
  if (staff instanceof Response) return staff;
  const id = Number((await ctx.params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return Response.json({ error: "Bad request" }, { status: 400 });
  if (!mailReady()) return Response.json({ error: "Email isn't set up yet: add SMTP_USER and SMTP_PASS in Cloudflare." }, { status: 503 });
  const [row] = await db().select().from(b).where(eq(b.id, id)).limit(1).catch(() => []);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  if (row.status !== "approved") return Response.json({ error: "Approve this application first." }, { status: 409 });
  const invite = await emailInvite(row, staff.id);
  if (invite !== "sent") return Response.json({ error: "The email couldn't be sent. Check the mailbox settings and try again." }, { status: 502 });
  return Response.json({ invite });
}
