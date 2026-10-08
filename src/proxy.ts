import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

/** Pages anyone can open without signing in. Everything else needs an account. */
const isPublic = createRouteMatcher(["/beta(.*)", "/sign-in(.*)", "/sign-up(.*)", "/api/webhooks(.*)", "/dev(.*)"]);

const withClerk = clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
});

/**
 * Sign-in turns on once CLERK_SECRET_KEY is set. Until then the app runs as a design preview,
 * so the site never breaks while keys are being added.
 */
export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (!process.env.CLERK_SECRET_KEY) return NextResponse.next();
  return withClerk(req, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
