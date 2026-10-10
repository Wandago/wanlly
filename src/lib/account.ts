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
  // OWNER_EMAILS (Cloudflare setting, comma-separated): these people are made owners when they sign
  // in, so the team never depends on editing the database by hand. Only a verified email counts.
  const owners = (process.env.OWNER_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  const owner = !!email && u.primaryEmailAddress?.verification?.status === "verified" && owners.includes(email.toLowerCase());
  const name = u.fullName || u.username || null;
  const phoneVerified = u.phoneNumbers.some((p) => p.verification?.status === "verified");
  // Named columns only, so a column added by a newer migration can't break sign-in before it runs.
  const q = rawSql();
  const [row] = (await q`
    insert into users (id, email, name, phone_verified, country) values (${u.id}, ${email}, ${name}, ${phoneVerified}, ${country})
    on conflict (id) do update set email = excluded.email, name = excluded.name, phone_verified = users.phone_verified or excluded.phone_verified,
      country = coalesce(users.country, excluded.country), updated_at = now()
    returning id, email, country, status, role`) as { id: string; email: string | null; country: string | null; status: string; role: string }[];
  if (owner && row && row.role !== "owner") {
    await q`update users set role = 'owner' where id = ${u.id}`;
    row.role = "owner";
  }
  return row as { id: string; email: string | null; country: string | null; status: (typeof schema.users.$inferSelect)["status"]; role: (typeof schema.users.$inferSelect)["role"] };
}
