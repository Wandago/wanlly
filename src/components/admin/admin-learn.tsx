"use client";

import { useCallback, useEffect, useState } from "react";
import { Markdown } from "../markdown";
import { Card, Chip, Empty, Loading, api, btnDark, btnGhost, when } from "./admin-ui";

type Article = {
  id: number;
  slug: string;
  title: string;
  description: string;
  body: string;
  tags: string[];
  sources: { title: string; url: string }[];
  status: "draft" | "published" | "hidden";
  model: string | null;
  createdAt: string;
  publishedAt: string | null;
};
type Data = { articles: Article[]; auto: boolean; autoPublish: boolean; canEdit: boolean };

/** Learn: the daily article on AI and tech news, written from real headlines, reviewed and published here. */
export function LearnTab() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [writing, setWriting] = useState(false);
  const load = useCallback(() => {
    api<Data>("/api/admin/articles")
      .then((d) => setData(d))
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(load, [load]);

  const flip = async (key: "articlesAuto" | "articlesAutoPublish", on: boolean) => {
    const ask =
      key === "articlesAuto"
        ? on
          ? "Write an article from the day's AI and tech news every morning (07:00 Nairobi)? Give a reason for the log."
          : "Stop the daily article? Give a reason for the log."
        : on
          ? "Publish each daily article straight away, without a person reading it first? Give a reason for the log."
          : "Keep daily articles as drafts until someone publishes them? Give a reason for the log.";
    const reason = window.prompt(ask);
    if (!reason?.trim()) return;
    try {
      await api("/api/admin/flags", "POST", { key, on, reason });
      load();
    } catch (e) {
      setNote((e as Error).message);
    }
  };
  const write = async () => {
    setWriting(true);
    setNote("Reading today's news and writing… this takes a minute or two.");
    try {
      const { article } = await api<{ article: Article }>("/api/admin/articles", "POST");
      setNote(`✓ Drafted "${article.title}". Read it below, then publish it.`);
      setOpen(article.id);
      load();
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setWriting(false);
    }
  };
  const setStatus = async (a: Article, status: Article["status"]) => {
    try {
      await api(`/api/admin/articles/${a.id}`, "PATCH", { status });
      load();
    } catch (e) {
      setNote((e as Error).message);
    }
  };
  const remove = async (a: Article) => {
    if (!window.confirm(`Delete "${a.title}"? This can't be undone.`)) return;
    try {
      await api(`/api/admin/articles/${a.id}`, "DELETE");
      load();
    } catch (e) {
      setNote((e as Error).message);
    }
  };

  if (error) return <Empty>{error}</Empty>;
  if (!data) return <Loading />;
  const drafts = data.articles.filter((a) => a.status === "draft").length;
  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Daily article"
        note="Every morning (07:00 Nairobi) an AI model reads the last two days of AI and tech headlines (TechCabal, TechCrunch, The Verge, MIT Technology Review, Hacker News, Google News Africa) and writes one practical article, citing only those reports. It's labelled as AI-written on the page. Read each one before publishing: Google can treat unreviewed AI articles as low-value, which works against AdSense approval."
        actions={
          data.canEdit && (
            <button type="button" className={btnDark} disabled={writing} onClick={write}>
              {writing ? "Writing…" : "Write one now"}
            </button>
          )
        }
      >
        <div className="flex flex-wrap gap-2 text-[13px]">
          <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5">
            <input type="checkbox" checked={data.auto} disabled={!data.canEdit} onChange={(e) => flip("articlesAuto", e.target.checked)} />
            Write one every day
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5">
            <input type="checkbox" checked={data.autoPublish} disabled={!data.canEdit} onChange={(e) => flip("articlesAutoPublish", e.target.checked)} />
            Publish without review
          </label>
          <a href="/learn" target="_blank" rel="noopener noreferrer" className={btnGhost}>
            Open Learn ↗
          </a>
        </div>
        {drafts > 0 && <p className="text-[13px] text-muted">{drafts === 1 ? "1 draft is" : `${drafts} drafts are`} waiting to be read.</p>}
        {note && <p className={`text-[13px] ${note.startsWith("✓") || note.startsWith("Reading") ? "text-muted" : "text-bad"}`}>{note}</p>}
      </Card>
      <Card title="Articles" note="Drafts aren't public. Published ones are on wanlly.africa/learn and in the sitemap; Hide takes one off the site.">
        {data.articles.length === 0 ? (
          <Empty>No articles yet. Press Write one now, or switch on the daily article.</Empty>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {data.articles.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <button type="button" onClick={() => setOpen(open === a.id ? null : a.id)} className="text-left font-medium hover:underline">
                      {a.title}
                    </button>
                    <small className="text-xs text-muted">
                      {when(a.createdAt)} · {a.model ?? "AI"} · {a.body.split(/\s+/).length} words · {a.sources.length} sources
                    </small>
                  </div>
                  <Chip s={a.status === "published" ? "active" : a.status === "draft" ? "pending" : "frozen"} label={a.status} />
                  {data.canEdit && (
                    <div className="flex gap-1.5">
                      {a.status !== "published" ? (
                        <button type="button" className={btnDark} onClick={() => setStatus(a, "published")}>
                          Publish
                        </button>
                      ) : (
                        <>
                          <a href={`/learn/${a.slug}`} target="_blank" rel="noopener noreferrer" className={btnGhost}>
                            View ↗
                          </a>
                          <button type="button" className={btnGhost} onClick={() => setStatus(a, "hidden")}>
                            Hide
                          </button>
                        </>
                      )}
                      <button type="button" className={btnGhost} onClick={() => remove(a)}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                {open === a.id && (
                  <div className="flex flex-col gap-3 rounded-xl border border-line bg-bg p-4 text-[14px]">
                    <p className="text-muted">{a.description}</p>
                    <Markdown text={a.body} />
                    <div className="flex flex-col gap-1 border-t border-line pt-3 text-xs text-muted">
                      <b className="text-fg">Sources (check the facts against these)</b>
                      {a.sources.map((s) => (
                        <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                          {s.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
