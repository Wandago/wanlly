import "server-only";
import { rawSql } from "@/db";
import { providers, streamReply } from "./ai";
import { MODELS, isLive } from "./catalog";

/*
 * Wanlly's Learn section: one article a day on AI and tech news, for the public site (people,
 * search engines, and the ad networks' reviewers). Each article is written by an AI model from
 * real headlines fetched that morning from the news feeds below, cites them with links, and is
 * labelled as AI-assisted. It waits in Admin → Learn for a person to publish it, unless
 * Auto-publish is switched on. Run daily by the Worker's cron (Admin → Learn → Daily article).
 */

export type Source = { title: string; url: string };
export type Article = {
  id: number;
  slug: string;
  title: string;
  description: string;
  body: string;
  tags: string[];
  sources: Source[];
  status: "draft" | "published" | "hidden";
  model: string | null;
  createdAt: string;
  publishedAt: string | null;
};

/** Public feeds on AI and tech, with African tech news in the mix. */
const FEEDS = [
  "https://techcabal.com/feed/",
  "https://techcrunch.com/category/artificial-intelligence/feed/",
  "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
  "https://news.google.com/rss/search?q=artificial+intelligence+Africa+when:2d&hl=en-KE&gl=KE&ceid=KE:en",
  "https://www.technologyreview.com/topic/artificial-intelligence/feed",
  "https://techpoint.africa/feed/",
  "https://hnrss.org/newest?q=AI&points=150",
];

/** Models that write the article, best first; the first one that's connected is used. */
const WRITERS = ["sonnet", "gemini-argo", "kimi", "glm", "gemini-flash"];

let ready = false;
export async function ensureArticles() {
  if (ready) return;
  await rawSql()`create table if not exists articles (
    id bigserial primary key, slug text not null unique, title text not null, description text not null, body text not null,
    tags jsonb not null default '[]', sources jsonb not null default '[]', status text not null default 'draft', model text,
    created_at timestamptz not null default now(), published_at timestamptz, updated_at timestamptz not null default now())`;
  ready = true;
}

const row = (r: Record<string, unknown>): Article => ({
  id: Number(r.id),
  slug: String(r.slug),
  title: String(r.title),
  description: String(r.description),
  body: String(r.body ?? ""),
  tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
  sources: Array.isArray(r.sources) ? (r.sources as Source[]) : [],
  status: r.status as Article["status"],
  model: (r.model as string) ?? null,
  createdAt: new Date(String(r.created_at)).toISOString(),
  publishedAt: r.published_at ? new Date(String(r.published_at)).toISOString() : null,
});

/** Published articles, newest first (without bodies). */
export async function publishedArticles(limit = 60): Promise<Article[]> {
  await ensureArticles();
  const rows = (await rawSql()`select id, slug, title, description, '' as body, tags, sources, status, model, created_at, published_at
    from articles where status = 'published' order by published_at desc limit ${limit}`) as Record<string, unknown>[];
  return rows.map(row);
}

export async function articleBySlug(slug: string): Promise<Article | null> {
  await ensureArticles();
  const [r] = (await rawSql()`select * from articles where slug = ${slug} and status = 'published'`) as Record<string, unknown>[];
  return r ? row(r) : null;
}

/** Every article for the admin page, newest first. */
export async function allArticles(): Promise<Article[]> {
  await ensureArticles();
  return ((await rawSql()`select * from articles order by created_at desc limit 100`) as Record<string, unknown>[]).map(row);
}

export async function setArticleStatus(id: number, status: Article["status"]) {
  await ensureArticles();
  await rawSql()`update articles set status = ${status}, updated_at = now(),
    published_at = case when ${status} = 'published' then coalesce(published_at, now()) else published_at end where id = ${id}`;
}

export async function deleteArticle(id: number) {
  await ensureArticles();
  await rawSql()`delete from articles where id = ${id}`;
}

type NewsItem = { title: string; url: string; summary: string; published: number; source: string };

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** The latest items from one RSS or Atom feed. */
async function readFeed(url: string): Promise<NewsItem[]> {
  const r = await fetch(url, { headers: { "user-agent": "WanllyNewsBot/1.0 (+https://wanlly.africa/learn)", accept: "*/*" }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${r.status}`);
  const xml = (await r.text()).slice(0, 400_000);
  const source = new URL(url).hostname.replace(/^www\./, "");
  const out: NewsItem[] = [];
  for (const m of xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/g)) {
    const block = m[0];
    const tag = (t: string) => block.match(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)</${t}>`))?.[1] ?? "";
    const link = block.match(/<link\b[^>]*href="([^"]+)"/)?.[1] ?? decode(tag("link"));
    const title = decode(tag("title"));
    if (!title || !/^https?:\/\//.test(link)) continue;
    const when = Date.parse(decode(tag("pubDate") || tag("published") || tag("updated") || tag("dc:date")));
    out.push({ title, url: link.trim(), summary: decode(tag("description") || tag("summary") || tag("content")).slice(0, 400), published: Number.isNaN(when) ? 0 : when, source });
    if (out.length >= 12) break;
  }
  return out;
}

/** The last two days' headlines across the feeds (feeds that fail are skipped). */
export async function latestNews(): Promise<NewsItem[]> {
  const lists = await Promise.all(FEEDS.map((f) => readFeed(f).catch((e) => (console.error("news feed failed", f, e instanceof Error ? e.message : e), []))));
  const since = Date.now() - 2 * 86_400_000;
  const seen = new Set<string>();
  return lists
    .flat()
    .filter((n) => (n.published === 0 || n.published >= since) && !seen.has(n.url) && (seen.add(n.url), true))
    .sort((a, b) => b.published - a.published)
    .slice(0, 40);
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/, "");

/** Links in the body that aren't one of the news sources (or Wanlly) become plain text. */
function keepKnownLinks(body: string, allowed: Set<string>) {
  return body.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (all, text: string, url: string) => (allowed.has(url) || /^https:\/\/wanlly\.africa(\/|$)/.test(url) ? all : text));
}

/**
 * Writes one article from today's news and saves it (as a draft, or published when `publish`).
 * Returns it, or throws with the reason.
 */
export async function writeDailyArticle(opts: { publish: boolean }): Promise<Article> {
  await ensureArticles();
  const live = providers();
  const writer = WRITERS.map((id) => MODELS.find((m) => m.id === id)).find((m) => m && isLive(m, live));
  if (!writer) throw new Error("No writing model is connected.");
  const news = await latestNews();
  if (news.length < 5) throw new Error(`Only ${news.length} news items came back from the feeds.`);
  const recent = ((await rawSql()`select title from articles order by created_at desc limit 20`) as { title: string }[]).map((r) => r.title);

  const system = `You write for Learn, the articles section of Wanlly (wanlly.africa), a free AI platform for students, creators and small businesses, most of them in Africa.
Write ONE original article, 800 to 1,100 words, about the most useful story or trend in today's AI and tech news below. Prefer stories that matter to people in Africa (TechCabal and Disrupt Africa items are good picks), or global AI news with a clear practical angle.
Rules:
- Facts come ONLY from the news items given. Never invent numbers, quotes, dates, product names or events. If a detail isn't in the items, leave it out. You may explain general background knowledge plainly.
- Link the items you use inline, as Markdown links with their exact URLs. No other links.
- Structure: a short intro; "## What happened"; "## Why it matters"; "## What you can do with this" (practical steps for students, creators or small businesses); a one-line closing. Use ## headings only, short paragraphs, and lists where they help.
- Plain, friendly British English. No hype words ("revolutionary", "game-changer"), no clickbait, no emojis. Don't mention that you are an AI.
- Pick a different topic from these recent articles: ${recent.length ? recent.map((t) => `"${t}"`).join("; ") : "(none yet)"}.
Reply with JSON only, no code fence: {"title": "...", "description": "one sentence, under 160 characters", "tags": ["2 to 4 short tags"], "sources": [{"title": "...", "url": "..."}], "body": "the article in Markdown, without the title"}`;
  const items = news.map((n, i) => `${i + 1}. [${n.source}] ${n.title}\n${n.url}\n${n.summary}`).join("\n\n");

  let text = "";
  for await (const ev of streamReply({ modelId: writer.id, tool: "chat", system, turns: [{ role: "user", text: `Today's news items:\n\n${items}` }], signal: AbortSignal.timeout(240_000) })) {
    if (ev.type === "text") text += ev.text;
  }
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  let out: { title?: unknown; description?: unknown; tags?: unknown; sources?: unknown; body?: unknown };
  try {
    out = JSON.parse(json);
  } catch {
    throw new Error("The model's reply wasn't valid JSON.");
  }
  const allowed = new Set(news.map((n) => n.url));
  const title = typeof out.title === "string" ? out.title.trim().slice(0, 140) : "";
  const description = typeof out.description === "string" ? out.description.trim().slice(0, 200) : "";
  const body = typeof out.body === "string" ? keepKnownLinks(out.body.replace(/^#\s+.*\n+/, "").trim(), allowed) : "";
  const sources = (Array.isArray(out.sources) ? out.sources : [])
    .filter((s): s is Source => !!s && typeof (s as Source).url === "string" && allowed.has((s as Source).url))
    .map((s) => ({ title: String(s.title || news.find((n) => n.url === s.url)?.title || s.url).slice(0, 200), url: s.url }))
    .slice(0, 8);
  const tags = (Array.isArray(out.tags) ? out.tags : []).filter((t): t is string => typeof t === "string").map((t) => t.trim().slice(0, 30)).filter(Boolean).slice(0, 4);
  const words = body.split(/\s+/).length;
  if (!title || !description) throw new Error("The article came back without a title or description.");
  if (words < 500) throw new Error(`The article was too short (${words} words).`);
  if (!sources.length) throw new Error("The article didn't cite any of today's news items.");

  const slug = `${slugify(title) || "ai-news"}-${new Date().toISOString().slice(0, 10)}`;
  const [r] = (await rawSql()`insert into articles (slug, title, description, body, tags, sources, status, model, published_at)
    values (${slug}, ${title}, ${description}, ${body}, ${JSON.stringify(tags)}::jsonb, ${JSON.stringify(sources)}::jsonb,
      ${opts.publish ? "published" : "draft"}, ${writer.name}, ${opts.publish ? new Date().toISOString() : null})
    on conflict (slug) do nothing returning *`) as Record<string, unknown>[];
  if (!r) throw new Error("An article with this title already exists today.");
  return row(r);
}

/** For the cron: today's article, once a day, when switched on. */
export async function dailyArticleRun() {
  await ensureArticles();
  const [flags] = (await rawSql()`select
      coalesce((select value = 'true'::jsonb from app_flags where key = 'articlesAuto'), false) as on,
      coalesce((select value = 'true'::jsonb from app_flags where key = 'articlesAutoPublish'), false) as publish,
      exists (select 1 from articles where created_at >= date_trunc('day', now())) as done`) as { on: boolean; publish: boolean; done: boolean }[];
  if (!flags?.on) return "off";
  if (flags.done) return "already written today";
  const a = await writeDailyArticle({ publish: flags.publish });
  return `${a.status}: ${a.title}`;
}
