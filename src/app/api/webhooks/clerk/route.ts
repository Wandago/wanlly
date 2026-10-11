import { REFERRAL_CAP, REFERRAL_CREDITS } from "@/lib/catalog";
import { post } from "@/lib/ledger";
import { alertTeam } from "@/lib/alerts";
import { SITE_URL } from "@/lib/site";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, rawSql, schema } from "@/db";

/**
 * Clerk calls this when a person signs up, changes their details or deletes their account.
 * The signature is checked (svix, with replay protection) before anything is written.
 */
/**
 * A friend joined with someone's invite link (/beta?ref=<their invite code>): both get
 * REFERRAL_CREDITS, once per new account, and an inviter is rewarded at most REFERRAL_CAP times.
 */
async function rewardReferral(newUserId: string, email: string) {
  const q = rawSql();
  const rows = (await q`
    select ru.id as referrer
    from beta_applications me
    join beta_applications inviter on inviter.invite_code = me.referral_code
    join users ru on lower(ru.email) = lower(inviter.email) and ru.status = 'active'
    where lower(me.email) = ${email.toLowerCase()} and me.referral_code is not null and lower(inviter.email) <> ${email.toLowerCase()}
    limit 1`) as { referrer: string }[];
  const referrer = rows[0]?.referrer;
  if (!referrer || referrer === newUserId) return;
  const [{ n }] = (await q`select count(*)::int as n from ledger_entries where user_id = ${referrer} and reason = 'referral' and ref_id like 'invited:%'`) as { n: number }[];
  if (n >= REFERRAL_CAP) return;
  await post(referrer, REFERRAL_CREDITS, "referral", `invited:${newUserId}`, "A friend joined with your invite link");
  await post(newUserId, REFERRAL_CREDITS, "referral", `joined:${newUserId}`, "Joined with a friend's invite link");
}

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
      on conflict (id) do update set email = excluded.email, name = excluded.name, phone_verified = users.phone_verified or excluded.phone_verified, updated_at = now()`;
    if (evt.type === "user.created" && email) await rewardReferral(u.id, email).catch((e) => console.error("referral reward failed", e));
    if (evt.type === "user.created") await alertTeam("signup", name ?? email ?? u.id, [email ?? "", `Signed up with ${u.external_accounts?.[0]?.provider?.replace("oauth_", "") ?? "email"}`], { link: `${SITE_URL}/admin#users` });
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
