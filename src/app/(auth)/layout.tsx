import Link from "next/link";

/** Sign-in and sign-up: the brand on the left, Clerk's form on the right. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="grid min-h-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="hidden flex-col justify-between bg-fg p-10 text-bg lg:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <svg viewBox="0 0 64 64" className="size-8" aria-hidden="true">
            <defs>
              <mask id="auth-node" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
                <rect width="64" height="64" fill="#fff" />
                <circle cx="32" cy="26" r="8.8" fill="#000" />
              </mask>
            </defs>
            <rect width="64" height="64" rx="16" className="fill-bg" />
            <path d="M11 21 L21 44 L32 26 L43 44 L53 21" mask="url(#auth-node)" fill="none" strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" className="stroke-fg" />
            <circle cx="32" cy="26" r="6.2" className="fill-accent" />
          </svg>
          <b className="font-display text-xl font-semibold tracking-[-0.02em]">Wanlly</b>
        </Link>
        <div className="flex max-w-[460px] flex-col gap-4">
          <h1 className="font-display text-[36px] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
            Build the thing you keep thinking about.
          </h1>
          <p className="text-lg opacity-70">Claude&apos;s best models for chat, code and design. One short video a day pays for it, wherever you live.</p>
        </div>
        <p className="text-[13px] opacity-50">Sponsors never see your prompts or your work.</p>
      </section>
      <section className="grid place-items-center px-4 py-10">{children}</section>
    </main>
  );
}
