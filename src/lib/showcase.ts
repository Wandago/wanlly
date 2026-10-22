import "server-only";
import { rawSql } from "@/db";

/*
 * The public showcase (wanlly.africa/showcase): apps people built in the Builder and published,
 * shown only when the owner asks for it (with a one-line description) and the team approves it in
 * Admin → Abuse → Published apps. Taking an app down or unpublishing it removes it too.
 */

export type ShowcaseEntry = { slug: string; title: string; blurb: string; updatedAt: string };

let ready = false;
export async function ensureShowcase() {
  if (ready) return;
  await rawSql()`alter table published_sites add column if not exists showcase boolean not null default false,
    add column if not exists showcase_title text, add column if not exists showcase_blurb text,
    add column if not exists showcase_approved boolean not null default false`;
  ready = true;
}

export async function publicShowcase(limit = 60): Promise<ShowcaseEntry[]> {
  await ensureShowcase();
  const rows = (await rawSql()`select slug, showcase_title, showcase_blurb, updated_at from published_sites
    where showcase and showcase_approved and not disabled order by updated_at desc limit ${limit}`) as Record<string, unknown>[];
  return rows.map((r) => ({ slug: String(r.slug), title: String(r.showcase_title ?? r.slug), blurb: String(r.showcase_blurb ?? ""), updatedAt: new Date(String(r.updated_at)).toISOString() }));
}

/** The owner's choice for their app. Changing the title or description sends it back for approval. */
export async function setShowcase(projectId: number, ownerId: string, on: boolean, title: string, blurb: string) {
  await ensureShowcase();
  await rawSql()`update published_sites set showcase = ${on}, showcase_title = ${title || null}, showcase_blurb = ${blurb || null},
    showcase_approved = case when ${on} and showcase_title is not distinct from ${title || null} and showcase_blurb is not distinct from ${blurb || null} then showcase_approved else false end
    where project_id = ${projectId} and owner_id = ${ownerId}`;
}

export async function showcaseFor(projectId: number) {
  await ensureShowcase();
  const [r] = (await rawSql()`select showcase, showcase_title, showcase_blurb, showcase_approved from published_sites where project_id = ${projectId}`) as Record<string, unknown>[];
  return r ? { on: r.showcase === true, title: (r.showcase_title as string) ?? "", blurb: (r.showcase_blurb as string) ?? "", approved: r.showcase_approved === true } : null;
}

export async function approveShowcase(slug: string, approved: boolean) {
  await ensureShowcase();
  await rawSql()`update published_sites set showcase_approved = ${approved} where slug = ${slug}`;
}
