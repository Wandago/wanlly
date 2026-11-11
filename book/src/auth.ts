// Sign-in by one-time email link. No passwords are stored. Tokens and sessions are stored as SHA-256 hashes,
// so a copy of the database can't be used to sign in.
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { iso } from "./time";
import type { Env, User, Vars } from "./types";

const COOKIE = "wb_session";
const SESSION_DAYS = 30;
const LINK_MINUTES = 15;

export async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function randomToken(bytes = 32): string {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export const normEmail = (s: string) => s.trim().toLowerCase();
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 254;

/** Creates a sign-in link, or returns null if this address asked too often (5 per 15 minutes). */
export async function createLoginLink(env: Env, email: string): Promise<string | null> {
  const since = iso(new Date(Date.now() - LINK_MINUTES * 60000));
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_tokens WHERE email = ? AND created_at > ?").bind(email, since).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 5) return null;
  const token = randomToken();
  await env.DB.prepare("INSERT INTO login_tokens (token_hash, email, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256(token), email, iso(new Date(Date.now() + LINK_MINUTES * 60000))).run();
  return `${env.APP_URL}/auth/verify?token=${token}`;
}

/** Uses a sign-in token once. Returns the user (created on first sign-in) or null. */
export async function redeemLoginToken(env: Env, token: string): Promise<User | null> {
  const used = await env.DB.prepare("UPDATE login_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING email")
    .bind(iso(new Date()), await sha256(token), iso(new Date())).first<{ email: string }>();
  if (!used) return null;
  await env.DB.prepare("INSERT OR IGNORE INTO users (email) VALUES (?)").bind(used.email).run();
  return env.DB.prepare("SELECT id, email, name FROM users WHERE email = ?").bind(used.email).first<User>();
}

type C = Context<{ Bindings: Env; Variables: Vars }>;

export async function startSession(c: C, userId: number) {
  const id = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await c.env.DB.prepare("INSERT INTO sessions (id_hash, user_id, expires_at) VALUES (?, ?, ?)").bind(await sha256(id), userId, iso(expires)).run();
  setCookie(c, COOKIE, id, { httpOnly: true, secure: new URL(c.req.url).protocol === "https:", sameSite: "Lax", path: "/", expires });
}

export async function endSession(c: C) {
  const id = getCookie(c, COOKIE);
  if (id) await c.env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?").bind(await sha256(id)).run();
  deleteCookie(c, COOKIE, { path: "/" });
}

export async function currentUser(c: C): Promise<User | null> {
  const id = getCookie(c, COOKIE);
  if (!id) return null;
  return c.env.DB.prepare("SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ? AND s.expires_at > ?")
    .bind(await sha256(id), iso(new Date())).first<User>();
}
