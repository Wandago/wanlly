import { rawSql } from "@/db";
import { signedInUserId } from "@/lib/session";

/**
 * The signed-in person's conversations, most recently active first. With ?q=, only those whose
 * title or any message contains the words (case doesn't matter).
 */
export async function GET(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const search = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  // Typed % and _ are matched literally.
  const like = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  try {
    const q = rawSql();
    const rows = (
      search
        ? await q`
            select c.id, c.title, c.tool, c.project_id, coalesce(max(m.created_at), c.created_at) as active
            from conversations c left join messages m on m.conversation_id = c.id
            where c.user_id = ${userId}
              and (c.title ilike ${like} or exists (
                select 1 from messages s where s.conversation_id = c.id and s.content->>'text' ilike ${like}))
            group by c.id order by active desc limit 50`
        : await q`
            select c.id, c.title, c.tool, c.project_id, coalesce(max(m.created_at), c.created_at) as active
            from conversations c left join messages m on m.conversation_id = c.id
            where c.user_id = ${userId}
            group by c.id order by active desc limit 30`
    ) as Record<string, unknown>[];
    return Response.json({
      conversations: rows.map((r) => ({ id: Number(r.id), title: String(r.title), tool: String(r.tool), projectId: r.project_id === null ? null : Number(r.project_id), active: r.active })),
    });
  } catch (e) {
    console.error("conversations GET failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
