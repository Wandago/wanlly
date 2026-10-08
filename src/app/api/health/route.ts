import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Which settings the live site can see, as yes/no only (never values), and whether the database
 * answers. Signed-in only, because the proxy protects every /api route except webhooks.
 */
export async function GET() {
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
    clerkPublishableKey: has("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    clerkWebhookSigningSecret: has("CLERK_WEBHOOK_SIGNING_SECRET"),
    database,
    tables,
  });
}
