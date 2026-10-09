import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { signedInUserId } from "@/lib/session";

const i = schema.images;

/** One of your pictures, as an image file. */
export async function GET(req: Request, ctx: RouteContext<"/api/images/[id]">) {
  const userId = await signedInUserId(req);
  if (!userId) return new Response(null, { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return new Response(null, { status: 400 });
  const [row] = await db().select({ data: i.data }).from(i).where(and(eq(i.id, id), eq(i.userId, userId))).limit(1);
  const m = row?.data.match(/^data:(image\/(?:webp|png|jpeg));base64,(.+)$/);
  if (!m) return new Response(null, { status: 404 });
  const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  return new Response(bytes, { headers: { "content-type": m[1], "cache-control": "private, max-age=86400", "x-content-type-options": "nosniff" } });
}

/** Deletes one of your pictures. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/images/[id]">) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return Response.json({ error: "Bad request" }, { status: 400 });
  await db().delete(i).where(and(eq(i.id, id), eq(i.userId, userId)));
  return Response.json({ ok: true });
}
