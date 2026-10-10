import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { smallJson } from "@/lib/forms";
import { signedInUserId } from "@/lib/session";
import { cleanSettings } from "@/lib/settings";
import { SAY } from "@/lib/messages";

async function current(userId: string) {
  const [row] = await db().select({ settings: schema.users.settings }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  return row ? cleanSettings(row.settings) : null;
}

export async function GET(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  try {
    const settings = await current(userId);
    return settings ? Response.json(settings) : Response.json({ error: SAY.settingUp }, { status: 404 });
  } catch (e) {
    console.error("settings GET failed", e);
    return Response.json({ error: SAY.busy }, { status: 503 });
  }
}

/** Saves the fields sent; anything not sent keeps its value. */
export async function PATCH(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  const data = await smallJson(req);
  if (!data) return Response.json({ error: SAY.badRequest }, { status: 400 });
  try {
    const base = await current(userId);
    if (!base) return Response.json({ error: SAY.settingUp }, { status: 404 });
    const settings = cleanSettings({ ...base, ...data, notify: { ...base.notify, ...(data.notify as object) } }, base);
    await db().update(schema.users).set({ settings }).where(eq(schema.users.id, userId));
    return Response.json(settings);
  } catch (e) {
    console.error("settings PATCH failed", e);
    return Response.json({ error: SAY.busy }, { status: 503 });
  }
}
