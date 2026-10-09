import { eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { ensureUser } from "@/lib/account";
import { account } from "@/lib/ledger";
import { clerk, signedInUserId } from "@/lib/session";
import { visitorHash } from "@/lib/traffic";
import { providers } from "@/lib/ai";
import { loadMemory } from "@/lib/memory";

/** The signed-in person's account: created on first call, then their balance, today's bonus and usage. */
export async function GET(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  try {
    const user = await ensureUser(userId, req.headers.get("cf-ipcountry"));
    // Which daily visitor hash this account was seen on, for spotting one person with many accounts.
    await db()
      .insert(schema.userDevices)
      .values({ userId: user.id, visitor: await visitorHash(req) })
      .onConflictDoUpdate({ target: [schema.userDevices.userId, schema.userDevices.visitor], set: { seenAt: sql`now()` } })
      .catch((e) => console.error("user device failed", e));
    const [acct, memory] = await Promise.all([account(user.id), loadMemory(user.id)]);
    return Response.json({ id: user.id, country: user.country, status: user.status, role: user.role, providers: providers(), memory, ...acct });
  } catch (e) {
    console.error("api/me failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}

/**
 * Deletes the account: personal details are cleared and projects removed here, then the sign-in
 * is deleted in Clerk. The credit ledger is kept without personal details, as an audit record.
 */
export async function DELETE(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  try {
    await db().update(schema.projects).set({ deletedAt: sql`now()` }).where(eq(schema.projects.ownerId, userId));
    // Generated designs are deleted outright; the project rows stay marked deleted.
    const owned = await db().select({ id: schema.projects.id }).from(schema.projects).where(eq(schema.projects.ownerId, userId));
    if (owned.length) await db().delete(schema.designVersions).where(inArray(schema.designVersions.projectId, owned.map((p) => p.id)));
    // Conversations are deleted outright.
    const convos = await db().select({ id: schema.conversations.id }).from(schema.conversations).where(eq(schema.conversations.userId, userId));
    if (convos.length) {
      await db().delete(schema.messages).where(inArray(schema.messages.conversationId, convos.map((c) => c.id)));
      await db().delete(schema.conversations).where(eq(schema.conversations.userId, userId));
    }
    // Pictures made in Images too (the table exists once migration 0010 has run).
    await db()
      .delete(schema.images)
      .where(eq(schema.images.userId, userId))
      .catch(() => {});
    await db()
      .update(schema.users)
      .set({ status: "deleted", email: null, name: null, settings: {}, updatedAt: sql`now()` })
      .where(eq(schema.users.id, userId));
    await clerk().users.deleteUser(userId);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("account delete failed", e);
    return Response.json({ error: "We couldn't delete your account just now. Please try again." }, { status: 503 });
  }
}
