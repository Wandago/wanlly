import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Mark } from "@/components/site/mark";

export const metadata: Metadata = { title: "Page not found · Wanlly", robots: { index: false } };

/** Any address that doesn't exist, in the site's own frame. */
export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col bg-bg">
      <SiteHeader />
      <main className="grid flex-1 place-items-center px-4 py-24">
        <div className="flex max-w-[440px] flex-col items-center gap-5 text-center">
          <Mark size={48} />
          <h1 className="font-display text-[clamp(30px,4vw,40px)] leading-[1.05] font-semibold tracking-[-0.035em]">This page doesn&apos;t exist</h1>
          <p className="text-muted">The link may be old or mistyped. Everything Wanlly does starts from the home page or the app.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/" className="rounded-lg bg-fg px-4 py-2.5 text-sm font-semibold text-bg hover:opacity-90">
              Go home
            </Link>
            <Link href="/app" className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium hover:border-faint">
              Open the app
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
