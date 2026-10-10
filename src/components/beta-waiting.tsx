"use client";

import { useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { SpinMark } from "./spin-mark";

/**
 * Shown over the app to someone signed in whose place in the private beta hasn't opened yet.
 * The server refuses their earning and spending too; this just says so kindly.
 */
export function BetaWaiting({ email }: { email: string | null }) {
  const { signOut } = useClerk();
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="waiting-title" className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-bg px-4 py-10">
      <div className="flex max-w-[460px] flex-col items-center gap-5 text-center">
        <SpinMark size={52} tile />
        <h1 id="waiting-title" className="font-display text-[clamp(28px,4vw,36px)] leading-[1.05] font-semibold tracking-[-0.035em]">
          You&apos;re on the list
        </h1>
        <p className="text-muted">
          Wanlly is in a private beta and lets people in every week. We&apos;ll email you as soon as your place opens. If you applied with a different email address{email ? ` than ${email}` : ""}, sign in with that one instead.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/beta" className="rounded-lg bg-fg px-4 py-2.5 text-sm font-semibold text-bg hover:opacity-90">
            Apply for the beta
          </Link>
          <button type="button" onClick={() => window.location.reload()} className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium hover:border-faint">
            Check again
          </button>
          <button type="button" onClick={() => signOut({ redirectUrl: "/" })} className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted hover:text-fg">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
