import { rawSql } from "@/db";
import { jsonUpTo } from "@/lib/forms";
import { cleanMemory } from "@/lib/memory";
import { signedInUserId } from "@/lib/session";

/** Saves the person's own edits to what Wanlly remembers about them. */
export async function PUT(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const data = await jsonUpTo(req, 20_000);
  if (!data) return Response.json({ error: "Bad request" }, { status: 400 });
  const memory = cleanMemory({ ...data, updatedAt: new Date().toISOString() });
  try {
    const q = rawSql();
    await q`update users set memory = ${memory ? JSON.stringify(memory) : null}::jsonb where id = ${userId}`;
    return Response.json({ memory });
  } catch {
    return Response.json({ error: "Run migration 0013 (memory) in Neon." }, { status: 503 });
  }
}

/** Forgets everything Wanlly remembered about the person. */
export async function DELETE(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  try {
    const q = rawSql();
    await q`update users set memory = null where id = ${userId}`;
  } catch {}
  return Response.json({ memory: null });
}
