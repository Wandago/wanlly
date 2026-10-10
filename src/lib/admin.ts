import "server-only";
import { eq } from "drizzle-orm";
import { db, rawSql, schema } from "@/db";
import { signedInUserId } from "./session";

type Role = (typeof schema.users.$inferSelect)["role"];

/* Who can do what on the admin page. Roles are set in the database, never from the browser. */
export const CAN = {
  view: ["owner", "admin", "support", "moderator", "analyst"],
  beta: ["owner", "admin", "support"],
  messages: ["owner", "admin", "support"],
  users: ["owner", "admin", "moderator"],
  switches: ["owner", "admin"],
  advertisers: ["owner", "admin"],
} satisfies Record<string, Role[]>;

export type Staff = { id: string; role: Role };

/** The signed-in staff member if they hold one of `roles`, or the Response to send instead. */
export async function requireStaff(req: Request, roles: readonly Role[]): Promise<Staff | Response> {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const [me] = await db().select({ role: schema.users.role, status: schema.users.status }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!me || me.status !== "active" || !roles.includes(me.role)) return Response.json({ error: "This page is for the Wanlly team." }, { status: 403 });
  return { id: userId, role: me.role };
}

export async function logAction(actorId: string, action: string, target: string, detail: Record<string, unknown> = {}) {
  await db().insert(schema.adminActions).values({ actorId, action, target, detail });
}

export const FLAGS = {
  earningPaused: "Earning is paused for everyone for a short while. Please try again later.",
  spendingPaused: "Wanlly's models are paused for everyone for a short while. Please try again later.",
  /** On when the beta ends: anyone who signs up can use Wanlly, not only approved applicants. */
  signupOpen: "",
} as const;
export type FlagKey = keyof typeof FLAGS;

/** Statuses that stop an account earning or spending. */
const BLOCKED = new Set(["frozen", "banned", "deleted"]);

/**
 * Null when this account may earn (or spend) right now; otherwise the message to show. Checks the
 * account's status and the team's pause switch in one query.
 */
export async function blockedReason(userId: string, action: "earn" | "spend"): Promise<string | null> {
  const flag: FlagKey = action === "earn" ? "earningPaused" : "spendingPaused";
  const q = rawSql();
  const rows = (await q`
    select (select status from users where id = ${userId}) as status,
      coalesce((select value = 'true'::jsonb from app_flags where key = ${flag}), false) as paused,
      (select u.role <> 'user'
          or coalesce((select value = 'true'::jsonb from app_flags where key = 'signupOpen'), false)
          or u.created_at < ${BETA_GATE_SINCE}::timestamptz
          or exists (select 1 from beta_applications b where lower(b.email) = lower(u.email) and b.status = 'approved')
        from users u where u.id = ${userId}) as access`) as { status: string | null; paused: boolean; access: boolean | null }[];
  const r = rows[0];
  if (r?.paused) return FLAGS[flag];
  if (r?.status && BLOCKED.has(r.status)) return "Your account is paused while we take a look. Contact us if you think this is a mistake.";
  if (r && r.access === false) return WAITING;
  return null;
}

/**
 * The private beta. Accounts made before the gate went live keep their place; after that, Wanlly
 * is for staff and people whose beta application was approved (matched by email), until the
 * signupOpen switch opens it to everyone.
 */
export const BETA_GATE_SINCE = "2026-10-10T00:00:00Z";
export const WAITING = "You're on the Wanlly beta list. We'll email you as soon as your place opens.";
/** Whether this person may use Wanlly yet (see BETA_GATE_SINCE). */
export async function hasAccess(userId: string): Promise<boolean> {
  const q = rawSql();
  const [r] = (await q`
    select u.role <> 'user'
        or coalesce((select value = 'true'::jsonb from app_flags where key = 'signupOpen'), false)
        or u.created_at < ${BETA_GATE_SINCE}::timestamptz
        or exists (select 1 from beta_applications b where lower(b.email) = lower(u.email) and b.status = 'approved') as access
    from users u where u.id = ${userId}`) as { access: boolean | null }[];
  return r?.access !== false;
}

/** The admin page's date range: 7 or 30 days, ending today (UTC). */
export const rangeDays = (req: Request) => (new URL(req.url).searchParams.get("days") === "7" ? 7 : 30);
