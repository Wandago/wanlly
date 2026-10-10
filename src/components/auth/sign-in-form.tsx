"use client";

import { SignIn } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { SpinLoader } from "../spin-mark";
import { authStarted, markStarted } from "./sign-up-gate";

/**
 * Clerk's sign-in. A copied #/factor-one… link opened in another tab or browser has no sign-in
 * behind it and would show a blank form, so such a link starts over at the first step.
 */
export function SignInForm() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const hash = window.location.hash;
    const midFlow = hash.startsWith("#/sso-callback") || (hash.startsWith("#/") && authStarted());
    if (hash && !midFlow) history.replaceState(null, "", window.location.pathname + window.location.search);
    markStarted();
    // Mount Clerk once the address is settled; deferred so it isn't a state change inside the effect.
    queueMicrotask(() => setReady(true));
  }, []);
  if (!ready) return <SpinLoader size={40} />;
  return <SignIn routing="hash" signUpUrl="/sign-up" fallbackRedirectUrl="/app" />;
}
