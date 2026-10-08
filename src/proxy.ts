import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/** Pages anyone can open without signing in. Everything else needs an account. */
const isPublic = createRouteMatcher(["/beta(.*)", "/sign-in(.*)", "/sign-up(.*)", "/api/webhooks(.*)", "/dev(.*)"]);

/**
 * Fails closed: without CLERK_SECRET_KEY, Clerk refuses to serve protected pages instead of
 * letting everyone in. Set it in Cloudflare (Settings > Variables and secrets, type Secret).
 */
export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
