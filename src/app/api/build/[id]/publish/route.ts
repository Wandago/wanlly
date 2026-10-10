import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { blockedReason } from "@/lib/admin";
import { loadFiles, ownBuild } from "@/lib/build";
import { buildPreview } from "@/lib/build-preview";
import { dbErrorMessage } from "@/lib/migrations";
import { SAY } from "@/lib/messages";
import { signedInUserId } from "@/lib/session";
import { SITE_URL } from "@/lib/site";

const s = schema.publishedSites;
/** A published page can be this large (the whole app inlined into one page). */
const MAX_HTML = 2_000_000;

async function owned(req: Request, ctx: RouteContext<"/api/build/[id]/publish">) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  const id = Number((await ctx.params).id);
  const project = Number.isSafeInteger(id) ? await ownBuild(id, userId).catch(() => null) : null;
  if (!project) return Response.json({ error: SAY.notFound }, { status: 404 });
  return { userId, id, name: project.name };
}

/** Where the app is published, if it is. */
export async function GET(req: Request, ctx: RouteContext<"/api/build/[id]/publish">) {
  const o = await owned(req, ctx);
  if (o instanceof Response) return o;
  const [row] = await db().select({ slug: s.slug, disabled: s.disabled, updatedAt: s.updatedAt }).from(s).where(eq(s.projectId, o.id)).limit(1).catch(() => []);
  return Response.json(row ? { url: `${SITE_URL}/s/${row.slug}`, disabled: row.disabled, updatedAt: row.updatedAt } : { url: null });
}

/** Publishes (or republishes) the app as it is now, at /s/<name>. Web apps only. */
export async function POST(req: Request, ctx: RouteContext<"/api/build/[id]/publish">) {
  const o = await owned(req, ctx);
  if (o instanceof Response) return o;
  const blocked = await blockedReason(o.userId, "spend").catch(() => null);
  if (blocked) return Response.json({ error: blocked }, { status: 403 });
  const html = buildPreview([...(await loadFiles(o.id))].map(([path, content]) => ({ path, content })));
  if (!html) return Response.json({ error: "Only apps that run in the preview (web or React apps) can be published. Server apps can be downloaded or saved to GitHub." }, { status: 400 });
  if (html.length > MAX_HTML) return Response.json({ error: "This app is too large to publish here (over 2 MB). Save it to GitHub and host it from there." }, { status: 413 });
  try {
    const [existing] = await db().select({ slug: s.slug, disabled: s.disabled }).from(s).where(eq(s.projectId, o.id)).limit(1);
    if (existing?.disabled) return Response.json({ error: "This app was taken down after a report. Contact us if you think that's a mistake." }, { status: 403 });
    const slug =
      existing?.slug ??
      `${o.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "app"}-${crypto.randomUUID().slice(0, 6)}`;
    await db()
      .insert(s)
      .values({ slug, projectId: o.id, ownerId: o.userId, html })
      .onConflictDoUpdate({ target: s.projectId, set: { html, updatedAt: sql`now()` } });
    return Response.json({ url: `${SITE_URL}/s/${slug}` });
  } catch (e) {
    console.error("publish failed", e);
    return Response.json({ error: dbErrorMessage(e).startsWith("The database is missing") ? "Publishing isn't switched on yet." : SAY.busy }, { status: 503 });
  }
}

/** Takes the app offline. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/build/[id]/publish">) {
  const o = await owned(req, ctx);
  if (o instanceof Response) return o;
  // A page the team took down stays down: deleting it can't clear the takedown.
  await db().delete(s).where(and(eq(s.projectId, o.id), eq(s.disabled, false))).catch(() => {});
  return Response.json({ ok: true });
}
