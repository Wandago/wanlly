import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

/** A campaign's picture, served as an image so cards can cache it. */
export async function GET(_req: Request, ctx: RouteContext<"/api/ads/image/[id]">) {
  const id = Number((await ctx.params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return new Response(null, { status: 400 });
  try {
    const [row] = await db().select({ image: schema.campaigns.image }).from(schema.campaigns).where(eq(schema.campaigns.id, id)).limit(1);
    const m = row?.image?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
    if (!m) return new Response(null, { status: 404 });
    const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    return new Response(bytes, { headers: { "content-type": m[1], "cache-control": "public, max-age=3600", "x-content-type-options": "nosniff" } });
  } catch {
    return new Response(null, { status: 503 });
  }
}
