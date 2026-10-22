import type { Metadata } from "next";
import Link from "next/link";
import { publicShowcase } from "@/lib/showcase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/showcase" },
  title: "Showcase · Apps built on Wanlly",
  description: "Websites and apps that students, creators and small businesses built with AI on Wanlly, for free.",
};

export default async function ShowcasePage() {
  const sites = await publicShowcase().catch(() => []);
  return (
    <>
      <section className="border-b border-line bg-side">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-3 px-4 py-16 sm:px-6">
          <span className="text-xs font-medium tracking-[0.08em] text-accent uppercase">Showcase</span>
          <h1 className="font-display text-[clamp(30px,4.4vw,46px)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">Built on Wanlly.</h1>
          <p className="max-w-[60ch] text-[15px] text-balance text-muted">
            Websites and apps people made in Wanlly&apos;s Builder by describing what they wanted, with no code and no subscription. Each one is shown here because its maker asked, and our team checked it first.
          </p>
        </div>
      </section>
      <div className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6">
        {sites.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-[15px] text-muted">The first apps are being reviewed. Built something on Wanlly? Publish it from the Builder and press Showcase.</p>
            <Link href="/sign-up" className="rounded-lg bg-fg px-4 py-2 text-sm font-semibold text-bg hover:opacity-90">
              Build yours free
            </Link>
          </div>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sites.map((s) => (
              <li key={s.slug} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="relative aspect-[4/3] overflow-hidden border-b border-line bg-white">
                  {/* A live, shrunken view of the app: sandboxed, so it can't reach Wanlly or the visitor. */}
                  <iframe
                    src={`/s/${s.slug}`}
                    title={`${s.title} preview`}
                    loading="lazy"
                    sandbox="allow-scripts"
                    tabIndex={-1}
                    aria-hidden="true"
                    className="pointer-events-none absolute top-0 left-0 h-[250%] w-[250%] origin-top-left scale-[0.4] border-0"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-4">
                  <b className="font-display text-[17px] font-semibold tracking-[-0.02em]">{s.title}</b>
                  <p className="flex-1 text-[14px] text-muted">{s.blurb}</p>
                  <a href={`/s/${s.slug}`} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 text-[13px] font-medium text-accent hover:underline hover:underline-offset-4">
                    Open the app →
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
