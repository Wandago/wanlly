import "server-only";
import { rawSql } from "@/db";
import { DAILY_SPEND_LIMIT, WEEKLY_SPEND_LIMIT, WEEKLY_SPEND_LIMIT_VERIFIED } from "./catalog";

/*
 * Extra usage for one person, set in Admin → People (for testers, partners, support cases):
 * higher session and weekly limits, or none at all, and optionally free use, where replies are
 * still recorded but the credits are topped up for them. Every grant has an end date; after it the
 * standard limits apply again by themselves.
 */

/** Stands in for "no limit" in the numbers the app shows and checks. */
export const NO_LIMIT = 1_000_000;

export type Access = {
  unlimited: boolean;
  dayLimit: number | null;
  weekLimit: number | null;
  free: boolean;
  expiresAt: string;
  note: string | null;
  grantedBy: string | null;
};

let ready = false;
export async function ensureAccess() {
  if (ready) return;
  await rawSql()`create table if not exists user_access (
    user_id text primary key references users(id), unlimited boolean not null default false,
    day_limit int, week_limit int, free boolean not null default false,
    expires_at timestamptz not null, note text, granted_by text, updated_at timestamptz not null default now())`;
  ready = true;
}

const row = (r: Record<string, unknown>): Access => ({
  unlimited: r.unlimited === true,
  dayLimit: r.day_limit == null ? null : Number(r.day_limit),
  weekLimit: r.week_limit == null ? null : Number(r.week_limit),
  free: r.free === true,
  expiresAt: new Date(String(r.expires_at)).toISOString(),
  note: (r.note as string) ?? null,
  grantedBy: (r.granted_by as string) ?? null,
});

/** This person's extra usage while it lasts, or null. Never throws: on any error, standard limits. */
export async function accessFor(userId: string): Promise<Access | null> {
  try {
    await ensureAccess();
    const [r] = (await rawSql()`select * from user_access where user_id = ${userId} and expires_at > now()`) as Record<string, unknown>[];
    return r ? row(r) : null;
  } catch (e) {
    console.error("access lookup failed", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Every active grant, by user id (for the admin list). */
export async function activeAccess(): Promise<Map<string, Access>> {
  await ensureAccess();
  const rows = (await rawSql()`select * from user_access where expires_at > now()`) as Record<string, unknown>[];
  return new Map(rows.map((r) => [String(r.user_id), row(r)]));
}

/** The session and weekly limits that apply to this person now. */
export function limitsFor(a: Access | null, verified: boolean) {
  const week = verified ? WEEKLY_SPEND_LIMIT_VERIFIED : WEEKLY_SPEND_LIMIT;
  if (a?.unlimited) return { day: NO_LIMIT, week: NO_LIMIT };
  return { day: a?.dayLimit ?? DAILY_SPEND_LIMIT, week: a?.weekLimit ?? week };
}

export async function setAccess(userId: string, a: Omit<Access, "grantedBy">, by: string) {
  await ensureAccess();
  await rawSql()`insert into user_access (user_id, unlimited, day_limit, week_limit, free, expires_at, note, granted_by, updated_at)
    values (${userId}, ${a.unlimited}, ${a.dayLimit}, ${a.weekLimit}, ${a.free}, ${a.expiresAt}, ${a.note}, ${by}, now())
    on conflict (user_id) do update set unlimited = excluded.unlimited, day_limit = excluded.day_limit, week_limit = excluded.week_limit,
      free = excluded.free, expires_at = excluded.expires_at, note = excluded.note, granted_by = excluded.granted_by, updated_at = now()`;
}

export async function clearAccess(userId: string) {
  await ensureAccess();
  await rawSql()`delete from user_access where user_id = ${userId}`;
}
