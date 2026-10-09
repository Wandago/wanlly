import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { field, jsonUpTo } from "@/lib/forms";
import { account } from "@/lib/ledger";
import { signedInUserId } from "@/lib/session";

/** Keeps a picture made in Images. Only for a job this person paid for, once per job. */
export async function POST(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const data = await jsonUpTo(req, 1_600_000);
  if (!data) return Response.json({ error: "That picture is too large to keep." }, { status: 413 });
  const jobId = field(data, "jobId", 64);
  const image = typeof data.data === "string" ? data.data : "";
  if (!/^[\w-]{8,64}$/.test(jobId) || !/^data:image\/(webp|png|jpeg);base64,/.test(image)) return Response.json({ error: "Bad request" }, { status: 400 });
  const d = db();
  const l = schema.ledgerEntries;
  // Paid and not refunded.
  const entries = await d.select({ reason: l.reason, delta: l.delta }).from(l).where(and(eq(l.userId, userId), eq(l.refId, jobId)));
  const paid = entries.find((e) => e.reason === "settle");
  if (!paid || entries.some((e) => e.reason === "release")) return Response.json({ error: "No paid image for this job" }, { status: 409 });
  try {
    const [row] = await d
      .insert(schema.images)
      .values({ userId, refId: jobId, prompt: field(data, "prompt", 2000) || "Image", model: field(data, "model", 80) || "gemini", credits: -paid.delta, data: image })
      .onConflictDoNothing()
      .returning({ id: schema.images.id, createdAt: schema.images.createdAt });
    return Response.json({ id: row?.id ?? null, createdAt: row?.createdAt ?? null, ...(await account(userId)) });
  } catch (e) {
    console.error("image save failed", e);
    return Response.json({ error: /relation "images"/.test(String(e)) ? "Run migration 0010 (images) in Neon." : "Couldn't keep that image." }, { status: 503 });
  }
}
