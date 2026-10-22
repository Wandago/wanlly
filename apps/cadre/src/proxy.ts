import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPrivate = createRouteMatcher(["/console(.*)", "/onboarding(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPrivate(req)) await auth.protect();
});

// Clerk only runs where it's needed. The landing page, health check and previews work without it.
export const config = {
  matcher: ["/console/:path*", "/onboarding/:path*", "/sign-in/:path*", "/sign-up/:path*"],
};
