import { rawSql } from "@/db";
import { signedInUserId } from "@/lib/session";

/** The signed-in person's recent conversations, most recently active first. */
export async function GET(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  try {
    const q = rawSql();
    const rows = (await q`
      select c.id, c.title, c.tool, c.project_id, coalesce(max(m.created_at), c.created_at) as active
      from conversations c left join messages m on m.conversation_id = c.id
      where c.user_id = ${userId}
      group by c.id order by active desc limit 30`) as Record<string, unknown>[];
    return Response.json({
      conversations: rows.map((r) => ({ id: Number(r.id), title: String(r.title), tool: String(r.tool), projectId: r.project_id === null ? null : Number(r.project_id), active: r.active })),
    });
  } catch (e) {
    console.error("conversations GET failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
