import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, rawSql, schema } from "@/db";

/**
 * Clerk calls this when a person signs up, changes their details or deletes their account.
 * The signature is checked (svix, with replay protection) before anything is written.
 */
export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (evt.type === "user.created" || evt.type === "user.updated") {
    const u = evt.data;
    const email = u.email_addresses.find((e) => e.id === u.primary_email_address_id)?.email_address ?? null;
    const phoneVerified = u.phone_numbers.some((p) => p.verification?.status === "verified");
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || null;
    // Named columns only, so a newer column can't break this before its migration runs.
    const q = rawSql();
    await q`
      insert into users (id, email, name, phone_verified) values (${u.id}, ${email}, ${name}, ${phoneVerified})
      on conflict (id) do update set email = excluded.email, name = excluded.name, phone_verified = excluded.phone_verified, updated_at = now()`;
  }

  if (evt.type === "user.deleted" && evt.data.id) {
    // Keep the row so the ledger stays whole; personal details are cleared.
    await db()
      .update(schema.users)
      .set({ status: "deleted", email: null, name: null, settings: {}, updatedAt: sql`now()` })
      .where(eq(schema.users.id, evt.data.id));
    // What Wanlly remembered about them goes too (the column comes with migration 0013).
    await rawSql()`update users set memory = null where id = ${evt.data.id}`.catch(() => {});
  }

  return new Response("ok");
}
