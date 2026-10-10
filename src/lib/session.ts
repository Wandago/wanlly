import "server-only";
import { createClerkClient } from "@clerk/nextjs/server";

/*
 * Server-side sign-in check for API routes. There is no proxy (middleware) on purpose: on the
 * Cloudflare free plan a check before every page uses more CPU than the 10 ms allowed. Pages
 * redirect signed-out visitors in the browser; anything that reads or changes data checks here.
 */

let client: ReturnType<typeof createClerkClient> | null = null;

export function clerk() {
  if (!client) {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) throw new Error("CLERK_SECRET_KEY is not set");
    client = createClerkClient({ secretKey, publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY });
  }
  return client;
}

/** The signed-in user's id for this request, or null. Verifies the Clerk session token. */
export async function signedInUserId(req: Request): Promise<string | null> {
  const state = await clerk().authenticateRequest(req, { acceptsToken: "session_token" });
  if (!state.isAuthenticated) return null;
  return state.toAuth().userId ?? null;
}

/** Why a request isn't signed in, for the health check: Clerk's reason and which kind of keys are set (never the keys). */
export async function signInProblem(req: Request) {
  const kind = (k: string | undefined) => (k ? (k.includes("_live_") ? "live" : k.includes("_test_") ? "test" : "other") : "missing");
  const keys = { secretKey: kind(process.env.CLERK_SECRET_KEY), publishableKey: kind(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) };
  try {
    const state = await clerk().authenticateRequest(req, { acceptsToken: "session_token" });
    return { reason: state.isAuthenticated ? null : (state.reason ?? "unknown"), message: state.isAuthenticated ? null : (state.message ?? null), ...keys };
  } catch (e) {
    return { reason: "error", message: e instanceof Error ? e.message.slice(0, 200) : "unknown", ...keys };
  }
}
