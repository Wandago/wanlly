import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { articleBySlug } from "@/lib/articles";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/learn/[slug]">): Promise<Metadata> {
  const a = await articleBySlug((await params).slug).catch(() => null);
  if (!a) return { title: "Not found · Wanlly" };
  return {
    title: `${a.title} · Wanlly Learn`,
    description: a.description,
    alternates: { canonical: `/learn/${a.slug}` },
    openGraph: { type: "article", title: a.title, description: a.description, publishedTime: a.publishedAt ?? undefined, tags: a.tags },
  };
}

export default async function ArticlePage({ params }: PageProps<"/learn/[slug]">) {
  const a = await articleBySlug((await params).slug).catch(() => null);
  if (!a) notFound();
  const date = a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Nairobi" }) : "";
  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.description,
    datePublished: a.publishedAt,
    dateModified: a.publishedAt,
    author: { "@type": "Organization", name: "Wanlly", url: SITE_URL },
    publisher: { "@type": "Organization", name: "Wanlly", url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}/learn/${a.slug}`,
    keywords: a.tags.join(", "),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <section className="border-b border-line bg-side">
        <div className="mx-auto flex max-w-[760px] flex-col gap-3 px-4 py-14 sm:px-6">
          <Link href="/learn" className="text-xs font-medium tracking-[0.08em] text-accent uppercase">
            ← Learn
          </Link>
          <h1 className="font-display text-[clamp(28px,4vw,42px)] leading-[1.08] font-semibold tracking-[-0.035em] text-balance">{a.title}</h1>
          <p className="text-[15px] text-balance text-muted">{a.description}</p>
          <span className="text-xs text-faint">
            {date}
            {a.tags.length ? ` · ${a.tags.join(" · ")}` : ""}
          </span>
        </div>
      </section>
      <article className="mx-auto flex max-w-[760px] flex-col gap-8 px-4 py-12 text-[15.5px] sm:px-6">
        <Markdown text={a.body} />
        {a.sources.length > 0 && (
          <section className="flex flex-col gap-2 border-t border-line pt-6">
            <h2 className="text-sm font-semibold">Sources</h2>
            <ul className="flex flex-col gap-1.5 text-[13.5px] text-muted">
              {a.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4 hover:text-fg">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="rounded-xl bg-code px-4 py-3 text-[13px] text-muted">
          How this was made: this article was written with AI from the news reports linked above, and only states what those reports say. If you spot a mistake, <Link href="/contact" className="underline underline-offset-4 hover:text-fg">tell us</Link> and we&apos;ll fix it.
        </p>
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-5">
          <b className="font-display text-lg font-semibold tracking-[-0.02em]">Try it yourself, free</b>
          <p className="text-[14px] text-muted">Chat, code and design with the world&apos;s top AI models on Wanlly. No card and no subscription.</p>
          <Link href="/sign-up" className="rounded-lg bg-fg px-4 py-2 text-sm font-semibold text-bg hover:opacity-90">
            Start free
          </Link>
        </div>
      </article>
    </>
  );
}
