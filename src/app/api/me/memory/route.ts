import { rawSql } from "@/db";
import { jsonUpTo } from "@/lib/forms";
import { cleanMemory } from "@/lib/memory";
import { signedInUserId } from "@/lib/session";
import { SAY } from "@/lib/messages";

/** Saves the person's own edits to what Wanlly remembers about them. */
export async function PUT(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  const data = await jsonUpTo(req, 20_000);
  if (!data) return Response.json({ error: SAY.badRequest }, { status: 400 });
  const memory = cleanMemory({ ...data, updatedAt: new Date().toISOString() });
  try {
    const q = rawSql();
    await q`update users set memory = ${memory ? JSON.stringify(memory) : null}::jsonb where id = ${userId}`;
    return Response.json({ memory });
  } catch (e) {
    // Before migration 0013 there's no memory column; Admin's Database card says so.
    console.error("memory save failed", e);
    return Response.json({ error: "Memory isn't available right now. Please try again later." }, { status: 503 });
  }
}

/** Forgets everything Wanlly remembered about the person. */
export async function DELETE(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  try {
    const q = rawSql();
    await q`update users set memory = null where id = ${userId}`;
  } catch {}
  return Response.json({ memory: null });
}
