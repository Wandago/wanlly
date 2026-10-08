import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Makes sure the signed-in person has a row in our database. Runs on every app load, so a missed
 * webhook never leaves someone without an account. Country comes from Cloudflare's network data
 * and is only set the first time; it can't be changed by the person.
 */
export async function ensureUser(country: string | null) {
  const u = await currentUser();
  if (!u) return null;
  const email = u.primaryEmailAddress?.emailAddress ?? null;
  const name = u.fullName || u.username || null;
  const phoneVerified = u.phoneNumbers.some((p) => p.verification?.status === "verified");
  const [row] = await db()
    .insert(schema.users)
    .values({ id: u.id, email, name, phoneVerified, country })
    .onConflictDoUpdate({
      target: schema.users.id,
      set: { email, name, phoneVerified, country: sql`coalesce(${schema.users.country}, excluded.country)`, updatedAt: sql`now()` },
    })
    .returning();
  return row;
}
