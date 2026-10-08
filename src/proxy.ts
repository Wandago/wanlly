import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextFetchEvent, NextRequest } from "next/server";

/** Pages anyone can open without signing in. Everything else needs an account. */
const isPublic = createRouteMatcher(["/beta(.*)", "/sign-in(.*)", "/sign-up(.*)", "/api/webhooks(.*)", "/dev(.*)"]);

/**
 * Fails closed: without CLERK_SECRET_KEY, Clerk refuses to serve protected pages instead of
 * letting everyone in. Set it in Cloudflare (Settings > Variables and secrets, type Secret).
 */
const withClerk = clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
});

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  // Say exactly what's missing (names only) rather than a bare "Internal Server Error".
  const missing = ["CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"].filter((k) => !process.env[k]);
  if (missing.length) {
    return new Response(`Wanlly isn't set up yet. Missing on the server: ${missing.join(", ")}.\nAdd it in Cloudflare: Workers > wanlly > Settings > Variables and secrets (type Secret).`, {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return withClerk(req, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
