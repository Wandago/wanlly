import "server-only";
import { rawSql, schema } from "@/db";
import { clerk } from "./session";

/**
 * Makes sure the signed-in person has a row in our database. Runs on every app load, so a missed
 * webhook never leaves someone without an account. Country comes from Cloudflare's network data
 * and is only set the first time; it can't be changed by the person.
 */
export async function ensureUser(userId: string, country: string | null) {
  const u = await clerk().users.getUser(userId);
  const email = u.primaryEmailAddress?.emailAddress ?? null;
  const name = u.fullName || u.username || null;
  const phoneVerified = u.phoneNumbers.some((p) => p.verification?.status === "verified");
  // Named columns only, so a column added by a newer migration can't break sign-in before it runs.
  const q = rawSql();
  const [row] = (await q`
    insert into users (id, email, name, phone_verified, country) values (${u.id}, ${email}, ${name}, ${phoneVerified}, ${country})
    on conflict (id) do update set email = excluded.email, name = excluded.name, phone_verified = excluded.phone_verified,
      country = coalesce(users.country, excluded.country), updated_at = now()
    returning id, country, status, role`) as { id: string; country: string | null; status: string; role: string }[];
  return row as { id: string; country: string | null; status: (typeof schema.users.$inferSelect)["status"]; role: (typeof schema.users.$inferSelect)["role"] };
}
