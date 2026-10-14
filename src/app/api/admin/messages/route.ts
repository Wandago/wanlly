import { desc, isNotNull, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { CAN, requireStaff } from "@/lib/admin";
import { ensureMessageColumns } from "@/lib/auto-reply";
import { rawSql } from "@/db";

const m = schema.contactMessages;

export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.messages);
  if (staff instanceof Response) return staff;
  const show = new URL(req.url).searchParams.get("show");
  try {
    const rows = await db()
      .select()
      .from(m)
      .where(show === "handled" ? isNotNull(m.handledAt) : show === "all" ? undefined : isNull(m.handledAt))
      .orderBy(desc(m.createdAt))
      .limit(200);
    // What was already sent back: the auto-reply and the team's reply (columns added on first use).
    await ensureMessageColumns();
    const sent = rows.length ? ((await rawSql()`select id, auto_reply, reply, replied_at from contact_messages where id = any(${rows.map((r) => r.id)})`) as { id: number; auto_reply: string | null; reply: string | null; replied_at: string | null }[]) : [];
    const by = new Map(sent.map((s) => [Number(s.id), s]));
    const auto = await rawSql()`select coalesce((select value = 'true'::jsonb from app_flags where key = 'autoReply'), false) as on`.then((r) => (r as { on: boolean }[])[0]?.on === true);
    return Response.json({ autoReply: auto, messages: rows.map((r) => ({ ...r, autoReply: by.get(r.id)?.auto_reply ?? null, reply: by.get(r.id)?.reply ?? null, repliedAt: by.get(r.id)?.replied_at ?? null })) });
  } catch (e) {
    console.error("admin messages GET failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
