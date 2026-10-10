import "server-only";
import { rawSql } from "@/db";

/*
 * Proving a phone number over WhatsApp, at no cost to Wanlly: the person sends a short code to
 * Wanlly's WhatsApp number, and Meta's webhook tells us which number sent it. Receiving messages
 * is free, and Wanlly never replies, so nothing is billed. WhatsApp has already checked that the
 * person owns the number, so a match proves it.
 *
 * Settings (Cloudflare): WHATSAPP_NUMBER (the business number, digits with country code, e.g.
 * 2547XXXXXXXX), WHATSAPP_VERIFY_TOKEN (any long random string, also typed into Meta's webhook
 * setup) and WHATSAPP_APP_SECRET (Meta app → Settings → Basic → App secret).
 */

export const whatsappReady = () => !!(process.env.WHATSAPP_NUMBER && process.env.WHATSAPP_VERIFY_TOKEN && process.env.WHATSAPP_APP_SECRET);

// No 0/O or 1/I, so a code read off a screen can't be mistyped.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE = /WANLLY-([A-HJ-NP-Z2-9]{6})/i;

/** A fresh code for this person and the wa.me link that opens WhatsApp with the message typed. */
export async function newCode(userId: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const code = `WANLLY-${[...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("")}`;
  const q = rawSql();
  await q.transaction([
    q`delete from whatsapp_codes where user_id = ${userId} or created_at < now() - interval '1 day'`,
    q`insert into whatsapp_codes (code, user_id) values (${code}, ${userId})`,
  ]);
  const text = `Verify my Wanlly account: ${code}`;
  return { code, link: `https://wa.me/${process.env.WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}` };
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** True when Meta signed this body with the app secret (the X-Hub-Signature-256 header). */
export async function signedByMeta(body: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const want = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  const got = header.slice(7).toLowerCase();
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

/** The number, hashed, so one number can be tied to one account without being stored. */
async function phoneHash(waId: string) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`wanlly-phone:${waId.replace(/\D/g, "")}`)));
}

type Inbound = { from?: string; text?: { body?: string }; button?: { text?: string } };

/**
 * Handles one webhook delivery: for each message carrying a live code, ties the sender's number
 * to that account and marks the phone verified. A number already tied to another account is
 * refused. Unknown or stale codes are ignored.
 */
export async function handleDelivery(payload: unknown) {
  const entries = (payload as { entry?: { changes?: { value?: { messages?: Inbound[] } }[] }[] })?.entry ?? [];
  const messages = entries.flatMap((e) => e.changes ?? []).flatMap((c) => c.value?.messages ?? []);
  const q = rawSql();
  for (const m of messages.slice(0, 20)) {
    const match = CODE.exec(m.text?.body ?? m.button?.text ?? "");
    if (!m.from || !match) continue;
    const code = `WANLLY-${match[1].toUpperCase()}`;
    const [row] = (await q`delete from whatsapp_codes where code = ${code} and created_at > now() - interval '30 minutes' returning user_id`) as { user_id: string }[];
    if (!row) continue;
    const hash = await phoneHash(m.from);
    // One number, one account; an account that re-verifies with the same number is fine.
    const [linked] = (await q`
      insert into phone_links (phone_hash, user_id) values (${hash}, ${row.user_id})
      on conflict do nothing returning user_id`) as { user_id: string }[];
    const [same] = linked ? [linked] : ((await q`select user_id from phone_links where phone_hash = ${hash} and user_id = ${row.user_id}`) as { user_id: string }[]);
    if (same) await q`update users set phone_verified = true, updated_at = now() where id = ${row.user_id}`;
  }
}
