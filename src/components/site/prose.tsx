import type { ReactNode } from "react";

/** Simple page frame for About and the legal pages: a header band and a readable column. */
export function ProsePage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <>
      <section className="border-b border-line bg-side">
        <div className="mx-auto flex max-w-[760px] flex-col gap-3 px-4 py-16 sm:px-6">
          <span className="text-xs font-medium tracking-[0.08em] text-accent uppercase">{eyebrow}</span>
          <h1 className="font-display text-[clamp(30px,4.4vw,46px)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">{title}</h1>
          {intro && <p className="text-[15px] text-muted text-balance">{intro}</p>}
        </div>
      </section>
      <article className="mx-auto flex max-w-[760px] flex-col gap-4 px-4 py-14 text-[15px] leading-relaxed sm:px-6 [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-[-0.02em] [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted [&_li]:text-muted [&_strong]:text-fg">
        {children}
      </article>
    </>
  );
}
