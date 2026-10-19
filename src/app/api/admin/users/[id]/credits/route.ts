import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { CAN, logAction, requireStaff } from "@/lib/admin";
import { emailHtml, emailText, type EmailContent } from "@/lib/email-layout";
import { field, smallJson } from "@/lib/forms";
import { balance, post } from "@/lib/ledger";
import { mailReady, sendMail } from "@/lib/mail";
import { SITE_URL } from "@/lib/site";

/** The most one grant can add or remove. */
const MAX = 5000;

/**
 * Adds credits to (or takes them from) one account, with a reason for the audit log. `requestId`
 * comes from the admin form, so a double click or a retry posts once. Removing never takes the
 * balance below zero. Optionally emails the person about credits added.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/users/[id]/credits">) {
  const staff = await requireStaff(req, CAN.credits);
  if (staff instanceof Response) return staff;
  const id = decodeURIComponent((await ctx.params).id);
  const data = await smallJson(req);
  const amount = Number(data?.amount);
  const reason = data ? field(data, "reason", 300) : "";
  const requestId = data ? field(data, "requestId", 80) : "";
  const notify = data?.notify === true;
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > MAX)
    return Response.json(
      {
        error: `Enter a whole number of credits, up to ${MAX.toLocaleString()} either way.`,
      },
      { status: 400 },
    );
  if (!reason) return Response.json({ error: "Give a reason. It goes in the log." }, { status: 400 });
  if (!/^[\w-]{8,80}$/.test(requestId)) return Response.json({ error: "Reload the page and try again." }, { status: 400 });
  try {
    const [target] = await db()
      .select({
        email: schema.users.email,
        name: schema.users.name,
        status: schema.users.status,
      })
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    if (!target || target.status === "deleted") return Response.json({ error: "Not found" }, { status: 404 });
    const before = await balance(id);
    const delta = amount > 0 ? amount : -Math.min(-amount, before);
    if (delta === 0) return Response.json({ error: "They have no credits to remove." }, { status: 400 });
    const posted = await post(id, delta, "admin_grant", `admin:${requestId}`, reason);
    if (!posted) return Response.json({ ok: true, duplicate: true, credits: before });
    await logAction(staff.id, delta > 0 ? "user.credits.add" : "user.credits.remove", `user:${id}`, { amount: delta, reason, before, after: before + delta });
    let emailed = false;
    if (notify && delta > 0 && target.email && mailReady()) {
      const first = target.name?.trim().split(/\s+/)[0] ?? "";
      const content: EmailContent = {
        preview: `${delta} credits are waiting in your Wanlly account.`,
        heading: first ? `${first}, you've got ${delta} credits` : `You've got ${delta} credits`,
        paragraphs: [`We've added **${delta} credits** to your Wanlly account.`, `Why: ${reason}`, "They're ready to use now, on any model."],
        button: { label: "Open Wanlly", url: `${SITE_URL}/app` },
        signoff: "Wanlly",
      };
      emailed = await sendMail({
        to: target.email,
        subject: `${delta} credits added to your Wanlly account`,
        text: emailText(content),
        html: emailHtml(content, SITE_URL),
      })
        .then(() => true)
        .catch((e) => (console.error("credit grant email failed", e instanceof Error ? e.message : e), false));
    }
    return Response.json({ ok: true, delta, credits: before + delta, emailed });
  } catch (e) {
    console.error("admin credits POST failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
