import Link from "next/link";
import { SpinMark } from "@/components/spin-mark";

/** Sign-in and sign-up: the brand on the left, Clerk's form on the right. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="grid min-h-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="hidden flex-col justify-between bg-fg p-10 text-bg lg:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <SpinMark size={32} />
          <b className="font-display text-xl font-semibold tracking-[-0.02em]">Wanlly</b>
        </Link>
        <div className="flex max-w-[460px] flex-col gap-4">
          <h1 className="font-display text-[36px] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
            Build the thing you keep thinking about.
          </h1>
          <p className="text-lg opacity-70">The world&apos;s top AI models for chat, code and design. One ad a day pays for it, wherever you live.</p>
        </div>
        <p className="text-[13px] opacity-50">Sponsors never see your prompts or your work.</p>
      </section>
      <section className="grid place-items-center px-4 py-10">{children}</section>
    </main>
  );
}
