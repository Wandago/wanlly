import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { CAN, requireStaff } from "@/lib/admin";
import { draftAnswer } from "@/lib/auto-reply";

/** A suggested reply to a contact message, written from Wanlly's facts, for the team to edit. */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/messages/[id]/draft">) {
  const staff = await requireStaff(req, CAN.messages);
  if (staff instanceof Response) return staff;
  const id = Number((await ctx.params).id);
  const [m] = await db().select().from(schema.contactMessages).where(eq(schema.contactMessages.id, id)).limit(1);
  if (!m) return Response.json({ error: "Not found" }, { status: 404 });
  const first = m.name.trim().split(/\s+/)[0];
  const answer = await draftAnswer(m.message, first);
  return Response.json({ draft: `Hi ${first},\n\n${answer ?? "Thanks for your message. "}\n\nLouis\nWanlly` });
}
