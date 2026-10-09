import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { ensureUser } from "@/lib/account";
import { account } from "@/lib/ledger";
import { clerk, signedInUserId } from "@/lib/session";

/** The signed-in person's account: created on first call, then their balance, today's bonus and usage. */
export async function GET(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  try {
    const user = await ensureUser(userId, req.headers.get("cf-ipcountry"));
    return Response.json({ id: user.id, country: user.country, status: user.status, ...(await account(user.id)) });
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
