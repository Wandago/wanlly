import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { blockedReason } from "@/lib/admin";
import { errorDetail, errorKind, requestImage } from "@/lib/ai";
import { readAttachments, MAX_BODY } from "@/lib/attachments";
import { TOOLS } from "@/lib/catalog";
import { field, jsonUpTo } from "@/lib/forms";
import { account, release, spend } from "@/lib/ledger";
import { signedInUserId } from "@/lib/session";

/*
 * Images: one picture per request from a Gemini image model. The price is taken first. The
 * model's response goes to the browser as it is (reading a multi-MB image here would exceed a
 * Worker's CPU time); its size alone tells whether a picture came back, and if not, the credits
 * are refunded. The browser then turns it into a small WebP and saves it with /api/images/save.
 */

const ERRORS = {
  busy: "The image model is busy right now. Your credits were refunded; try again in a moment.",
  unavailable: "Image making isn't available on Wanlly's current Gemini plan yet. Your credits were refunded.",
  failed: "Something went wrong making that image. Your credits were refunded.",
} as const;

/** An image response is hundreds of KB; a reply with no picture (refused, or text only) is a few KB. */
const MIN_IMAGE_BYTES = 20_000;

export async function POST(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const blocked = await blockedReason(userId, "spend").catch(() => null);
  if (blocked) return Response.json({ error: blocked }, { status: 403 });
  const data = await jsonUpTo(req, MAX_BODY);
  if (!data) return Response.json({ error: "That's too much to send at once. Attach smaller pictures." }, { status: 413 });
  const prompt = typeof data.prompt === "string" ? data.prompt.trim().slice(0, 2000) : "";
  const jobId = field(data, "jobId", 64);
  const attached = readAttachments(data.attachments);
  if (!attached) return Response.json({ error: "Those files can't be sent. Attach pictures, up to 4 at a time." }, { status: 400 });
  // Pictures guide the image (edit this photo, use this logo); other files add their text.
  const files = attached.files.filter((f) => f.mime.startsWith("image/"));
  if ((!prompt && !files.length) || !/^[\w-]{8,64}$/.test(jobId)) return Response.json({ error: "Describe the image you want." }, { status: 400 });

  const price = TOOLS.images.flatCredits ?? 5;
  const paid = await spend(userId, price, jobId, "Images").catch(() => null);
  if (!paid?.ok) {
    const reason = paid?.reason ?? "error";
    const acct = await account(userId).catch(() => null);
    const status = reason === "credits" ? 402 : reason === "day" || reason === "week" ? 429 : reason === "duplicate" ? 409 : 503;
    return Response.json({ error: reason === "credits" ? "Not enough credits" : "Couldn't start that", reason, ...(acct ?? {}) }, { status });
  }

  const text = (prompt || "Make an image from the attached picture.") + attached.text;
  let got: Awaited<ReturnType<typeof requestImage>>;
  try {
    got = await requestImage(text, files, req.signal);
  } catch (e) {
    await release(userId, price, jobId).catch(() => {});
    const kind = errorKind(e);
    const [me] = await db().select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.id, userId)).limit(1).catch(() => []);
    const detail = me && me.role !== "user" ? ` (Admin detail: ${errorDetail(e)})` : "";
    return Response.json({ error: (ERRORS[kind as keyof typeof ERRORS] ?? ERRORS.failed) + detail, refunded: true, ...(await account(userId).catch(() => ({}))) }, { status: kind === "busy" ? 503 : 502 });
  }

  // Count bytes on the way through (cheap); refund when no picture could be in there.
  let bytes = 0;
  const counted = got.res.body!.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, c) {
        bytes += chunk.byteLength;
        c.enqueue(chunk);
      },
      async flush() {
        if (bytes < MIN_IMAGE_BYTES) await release(userId, price, jobId).catch(() => {});
      },
    }),
  );
  return new Response(counted, { headers: { "content-type": "application/json", "x-wanlly-model": got.model, "x-wanlly-price": String(price), "cache-control": "no-store" } });
}

/** Your recent images: ids and prompts (the pictures come from /api/images/[id]). */
export async function GET(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  try {
    const i = schema.images;
    const rows = await db().select({ id: i.id, prompt: i.prompt, model: i.model, credits: i.credits, createdAt: i.createdAt }).from(i).where(eq(i.userId, userId)).orderBy(desc(i.createdAt)).limit(48);
    return Response.json({ images: rows });
  } catch {
    return Response.json({ images: [] });
  }
}
