import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, schema } from "@/db";

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
    await db()
      .insert(schema.users)
      .values({ id: u.id, email, name, phoneVerified })
      .onConflictDoUpdate({
        target: schema.users.id,
        set: { email, name, phoneVerified, updatedAt: sql`now()` },
      });
  }

  if (evt.type === "user.deleted" && evt.data.id) {
    // Keep the row so the ledger stays whole; personal details are cleared.
    await db()
      .update(schema.users)
      .set({ status: "deleted", email: null, name: null, updatedAt: sql`now()` })
      .where(eq(schema.users.id, evt.data.id));
  }

  return new Response("ok");
}
