"use client";

import { useReverification, useUser } from "@clerk/nextjs";
import { useCallback } from "react";

/**
 * Connects the person's GitHub (or asks again for permission to save repositories), then sends
 * the browser to GitHub to approve; it comes back to `back`. Clerk may first ask them to confirm
 * it's them, which useReverification shows. Throws a readable message when it can't start.
 */
export function useGithubConnect() {
  const { user } = useUser();
  const link = useReverification(async (back: string) => {
    const account = user?.externalAccounts.find((a) => a.provider.replace("oauth_", "") === "github");
    return account ? account.reauthorize({ additionalScopes: ["repo"], redirectUrl: back }) : user?.createExternalAccount({ strategy: "oauth_github", additionalScopes: ["repo"], redirectUrl: back });
  });
  return useCallback(
    async (back: string) => {
      try {
        const acct = await link(back);
        const url = acct?.verification?.externalVerificationRedirectURL;
        if (!url) throw new Error("GitHub didn't send a sign-in page back. Try again in a moment.");
        window.location.href = url.toString();
      } catch (e) {
        const clerk = (e as { errors?: { longMessage?: string; message?: string }[] })?.errors?.[0];
        throw new Error(clerk?.longMessage || clerk?.message || (e instanceof Error ? e.message : "Couldn't reach GitHub."));
      }
    },
    [link],
  );
}
