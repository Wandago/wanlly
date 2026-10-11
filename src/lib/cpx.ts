import "server-only";
import { createHash } from "node:crypto";

/*
 * CPX Research survey wall (Earn credits → Answer a short survey).
 * Settings (Cloudflare): CPX_APP_ID (the app id on CPX's dashboard) and CPX_SECURE_HASH (the
 * "secure hash" key under the app's Postback settings; keep it secret). Optional:
 * CPX_MAX_CREDITS, the most one survey may pay (default 500), so a misconfigured reward rate
 * can't hand out thousands.
 *
 * CPX shows each survey's reward in credits using the app's Reward settings, and passes the same
 * figure back as amount_local, so what people see is what they get.
 */

const md5 = (s: string) => createHash("md5").update(s).digest("hex");
// Trimmed: a key pasted into Cloudflare often picks up a stray space or line break.
const appId = () => (process.env.CPX_APP_ID ?? "").trim();
const key = () => (process.env.CPX_SECURE_HASH ?? "").trim();

export const cpxReady = () => !!(appId() && key());
export const cpxMaxCredits = () => Math.max(1, Number(process.env.CPX_MAX_CREDITS) || 500);

/** The wall for one person: their id, signed so nobody can open someone else's wall. */
export function cpxWallUrl(userId: string, name?: string | null, email?: string | null): string {
  const u = new URL("https://offers.cpx-research.com/index.php");
  u.searchParams.set("app_id", appId());
  u.searchParams.set("ext_user_id", userId);
  u.searchParams.set("secure_hash", md5(`${userId}-${key()}`));
  if (name) u.searchParams.set("username", name.slice(0, 60));
  if (email) u.searchParams.set("email", email);
  return u.toString();
}

/** CPX signs each postback with md5("<trans_id>-<secure hash key>"). */
export function cpxSigned(transId: string, hash: string): boolean {
  const want = md5(`${transId}-${key()}`);
  if (hash.length !== want.length) return false;
  let d = 0;
  for (let i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ hash.toLowerCase().charCodeAt(i);
  return d === 0;
}
