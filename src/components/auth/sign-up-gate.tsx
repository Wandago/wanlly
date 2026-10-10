"use client";

import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SAY } from "@/lib/messages";
import { SpinLoader } from "../spin-mark";

/*
 * Sign-up during the private beta: first the email they applied with. Approved emails get Clerk's
 * form with that email filled in; others are pointed to the beta page. Once the team opens
 * sign-up to everyone (Admin → Beta), this goes straight to the form. The app checks again after
 * sign-in, so changing the email inside the form doesn't get anyone past the beta.
 */

/** Clerk's form was shown in this tab, so a #/… address here belongs to a real sign-up. */
const MARK = "wanlly-auth-started";
const started = () => {
  try {
    return sessionStorage.getItem(MARK) === "1";
  } catch {
    return false;
  }
};
export const markStarted = () => {
  try {
    sessionStorage.setItem(MARK, "1");
  } catch {}
};
export { started as authStarted };

type Step = "loading" | "ask" | "approved" | "waiting" | "none" | "open";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-faint";

export function SignUpGate() {
  const [step, setStep] = useState<Step>("loading");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Back from Google or GitHub (#/sso-callback), or part-way through Clerk's steps in this tab
    // (#/verify…): let it finish. A copied #/verify link opened elsewhere has no sign-up behind
    // it and would show a blank form, so it starts over instead.
    const hash = window.location.hash;
    const midFlow = hash.startsWith("#/sso-callback") || (hash.startsWith("#/") && started());
    if (hash && !midFlow) history.replaceState(null, "", window.location.pathname + window.location.search);
    fetch("/api/beta/check", { method: "POST", body: "{}" })
      .then((r) => r.json())
      .then((b) => setStep(b.open || midFlow ? "open" : "ask"))
      .catch(() => setStep(midFlow ? "open" : "ask"));
  }, []);

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/beta/check", { method: "POST", body: JSON.stringify({ email }) });
      const b = await r.json();
      if (!r.ok) return setError(b.error ?? SAY.busy);
      setStep(b.open ? "open" : b.status === "approved" ? "approved" : b.status === "waiting" ? "waiting" : "none");
    } catch {
      setError(SAY.offline);
    } finally {
      setBusy(false);
    }
  };

  if (step === "loading") return <SpinLoader size={40} />;
  if (step === "open" || step === "approved") {
    markStarted();
    return <SignUp routing="hash" signInUrl="/sign-in" fallbackRedirectUrl="/app" initialValues={step === "approved" ? { emailAddress: email } : undefined} />;
  }

  const back = (
    <button type="button" onClick={() => setStep("ask")} className="text-sm text-muted underline-offset-2 hover:text-fg hover:underline">
      Use a different email
    </button>
  );
  return (
    <div className="flex w-full max-w-[400px] flex-col gap-5 rounded-[20px] border border-line bg-surface p-6 shadow-soft">
      {step === "ask" && (
        <form onSubmit={check} className="flex flex-col gap-4">
          <div>
            <h1 className="font-display text-xl font-semibold tracking-[-0.02em]">Create your account</h1>
            <p className="mt-1 text-sm text-muted">Wanlly is in a private beta. Enter the email you applied with to continue.</p>
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Email
            <input type="email" required autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
          </label>
          {error && <p className="text-[13px] text-bad">{error}</p>}
          <button type="submit" disabled={busy} className="rounded-lg bg-fg px-4 py-2.5 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-60">
            {busy ? "Checking…" : "Continue"}
          </button>
          <p className="text-center text-sm text-muted">
            Haven&apos;t applied yet?{" "}
            <Link href="/beta" className="font-medium text-fg underline-offset-2 hover:underline">
              Join the beta
            </Link>
          </p>
        </form>
      )}
      {step === "waiting" && (
        <>
          <div>
            <h1 className="font-display text-xl font-semibold tracking-[-0.02em]">You&apos;re on the list</h1>
            <p className="mt-1 text-sm text-muted">We have your application and let people in every week. We&apos;ll email {email} as soon as your place opens.</p>
          </div>
          {back}
        </>
      )}
      {step === "none" && (
        <>
          <div>
            <h1 className="font-display text-xl font-semibold tracking-[-0.02em]">Apply first</h1>
            <p className="mt-1 text-sm text-muted">We couldn&apos;t find a beta application for {email}. It takes a minute, and we let new people in every week.</p>
          </div>
          <Link href="/beta" className="rounded-lg bg-fg px-4 py-2.5 text-center text-sm font-semibold text-bg hover:opacity-90">
            Join the beta
          </Link>
          {back}
        </>
      )}
      <p className="border-t border-line pt-4 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-fg underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
