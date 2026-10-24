import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { servePicture } from "@/lib/ad-picture-serve";

/** A campaign's picture, served as an image so cards can cache it. */
export async function GET(req: Request, ctx: RouteContext<"/api/ads/image/[id]">) {
  const id = Number((await ctx.params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return new Response(null, { status: 400 });
  try {
    return await servePicture(req, async () => {
      const [row] = await db().select({ image: schema.campaigns.image }).from(schema.campaigns).where(eq(schema.campaigns.id, id)).limit(1);
      return row?.image;
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
