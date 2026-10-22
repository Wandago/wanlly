import { rawSql } from "@/db";
import { CAN, logAction, requireStaff } from "@/lib/admin";
import { allArticles, writeDailyArticle } from "@/lib/articles";

/** Every Learn article, and the two switches. */
export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.view);
  if (staff instanceof Response) return staff;
  try {
    const [articles, flags] = await Promise.all([
      allArticles(),
      rawSql()`select key, value = 'true'::jsonb as on from app_flags where key in ('articlesAuto', 'articlesAutoPublish')`,
    ]);
    const on = (k: string) => (flags as { key: string; on: boolean }[]).some((f) => f.key === k && f.on);
    return Response.json({ articles, auto: on("articlesAuto"), autoPublish: on("articlesAutoPublish"), canEdit: (CAN.switches as readonly string[]).includes(staff.role) });
  } catch (e) {
    console.error("admin articles GET failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}

/** Writes one article now from today's news, as a draft. */
export async function POST(req: Request) {
  const staff = await requireStaff(req, CAN.switches);
  if (staff instanceof Response) return staff;
  try {
    const article = await writeDailyArticle({ publish: false });
    await logAction(staff.id, "article.write", `article:${article.id}`, { title: article.title });
    return Response.json({ article });
  } catch (e) {
    console.error("admin article write failed", e);
    return Response.json({ error: e instanceof Error ? e.message : "Couldn't write the article." }, { status: 502 });
  }
}
