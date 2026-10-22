import { CAN, logAction, requireStaff } from "@/lib/admin";
import { deleteArticle, setArticleStatus } from "@/lib/articles";
import { smallJson } from "@/lib/forms";

const STATUSES = ["draft", "published", "hidden"] as const;

/** Publishes, hides or returns an article to drafts. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/articles/[id]">) {
  const staff = await requireStaff(req, CAN.switches);
  if (staff instanceof Response) return staff;
  const id = Number((await ctx.params).id);
  const data = await smallJson(req);
  const status = STATUSES.find((s) => s === data?.status);
  if (!Number.isSafeInteger(id) || !status) return Response.json({ error: "Pick a status." }, { status: 400 });
  await setArticleStatus(id, status);
  await logAction(staff.id, `article.${status}`, `article:${id}`);
  return Response.json({ ok: true, status });
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/admin/articles/[id]">) {
  const staff = await requireStaff(req, CAN.switches);
  if (staff instanceof Response) return staff;
  const id = Number((await ctx.params).id);
  if (!Number.isSafeInteger(id)) return Response.json({ error: "Not found" }, { status: 404 });
  await deleteArticle(id);
  await logAction(staff.id, "article.delete", `article:${id}`);
  return Response.json({ ok: true });
}
