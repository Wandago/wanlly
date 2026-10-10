import { sql } from "drizzle-orm";
import { db } from "@/db";
import { clerk, signInProblem, signedInUserId } from "@/lib/session";
import { SAY } from "@/lib/messages";

/**
 * Which settings the live site can see, as yes/no only (never values), and whether the database
 * answers. Signed-in only.
 */
export async function GET(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut, signIn: await signInProblem(req) }, { status: 401 });
  const has = (k: string) => Boolean(process.env[k]);
  let database: "ok" | "missing" | "error" = has("DATABASE_URL") ? "ok" : "missing";
  let tables = false;
  if (database === "ok") {
    try {
      const r = await db().execute(sql`select to_regclass('public.users') is not null as ok`);
      tables = Boolean((r.rows[0] as { ok?: boolean } | undefined)?.ok);
    } catch {
      database = "error";
    }
  }
  return Response.json({
    clerkSecretKey: has("CLERK_SECRET_KEY"),
    // Baked in at build time, so it's read directly rather than by name.
    clerkPublishableKey: Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
    clerkWebhookSigningSecret: has("CLERK_WEBHOOK_SIGNING_SECRET"),
    database,
    tables,
    ownerEmailsSet: has("OWNER_EMAILS"),
    me: database === "ok" ? await whoAmI(userId) : null,
  });
}

/** This account's role and whether its email is one OWNER_EMAILS names (so a typo shows up). */
async function whoAmI(userId: string) {
  try {
    const u = await clerk().users.getUser(userId);
    const email = u.primaryEmailAddress?.emailAddress?.toLowerCase() ?? "";
    const owners = (process.env.OWNER_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());
    const r = await db().execute(sql`select role, status from users where id = ${userId}`);
    const row = r.rows[0] as { role?: string; status?: string } | undefined;
    return { role: row?.role ?? "no account row yet", status: row?.status ?? null, emailVerified: u.primaryEmailAddress?.verification?.status === "verified", listedInOwnerEmails: !!email && owners.includes(email) };
  } catch {
    return null;
  }
}
