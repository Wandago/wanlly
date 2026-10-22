import type { Metadata } from "next";
import Link from "next/link";
import { publishedArticles } from "@/lib/articles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/learn" },
  title: "Learn · AI and tech news, explained · Wanlly",
  description: "A short, practical read every day on AI and tech news, and what it means for students, creators and small businesses in Africa.",
};

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Nairobi" }) : "");

export default async function LearnPage() {
  const articles = await publishedArticles().catch(() => []);
  return (
    <>
      <section className="border-b border-line bg-side">
        <div className="mx-auto flex max-w-[860px] flex-col gap-3 px-4 py-16 sm:px-6">
          <span className="text-xs font-medium tracking-[0.08em] text-accent uppercase">Learn</span>
          <h1 className="font-display text-[clamp(30px,4.4vw,46px)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">AI and tech news, explained.</h1>
          <p className="text-[15px] text-balance text-muted">One practical read a day: what happened in AI and tech, why it matters, and what you can do with it, whether you study, create or run a small business.</p>
        </div>
      </section>
      <div className="mx-auto max-w-[860px] px-4 py-12 sm:px-6">
        {articles.length === 0 ? (
          <p className="text-[15px] text-muted">The first articles are on their way. Check back soon.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-line">
            {articles.map((a) => (
              <li key={a.id} className="py-6 first:pt-0">
                <Link href={`/learn/${a.slug}`} className="group flex flex-col gap-1.5">
                  <span className="text-xs text-faint">
                    {day(a.publishedAt)}
                    {a.tags.length ? ` · ${a.tags.join(" · ")}` : ""}
                  </span>
                  <h2 className="font-display text-xl font-semibold tracking-[-0.02em] group-hover:underline group-hover:underline-offset-4">{a.title}</h2>
                  <p className="text-[15px] text-muted">{a.description}</p>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}
