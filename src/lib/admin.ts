import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { signedInUserId } from "./session";

type Role = (typeof schema.users.$inferSelect)["role"];

/* Who can do what on the admin page. Roles are set in the database, never from the browser. */
export const CAN = {
  view: ["owner", "admin", "support", "moderator", "analyst"],
  beta: ["owner", "admin", "support"],
  messages: ["owner", "admin", "support"],
  users: ["owner", "admin", "moderator"],
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

/** Statuses that stop an account earning or spending. */
const BLOCKED = new Set(["frozen", "banned", "deleted"]);

/** Null when the account may earn and spend; otherwise the message to show. */
export async function blockedReason(userId: string): Promise<string | null> {
  const [u] = await db().select({ status: schema.users.status }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!u) return null;
  return BLOCKED.has(u.status) ? "Your account is paused while we take a look. Contact us if you think this is a mistake." : null;
}
