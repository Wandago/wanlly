import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { signedInUserId } from "@/lib/session";
import { newCode, whatsappReady } from "@/lib/whatsapp";
import { SAY } from "@/lib/messages";

/** Whether this person's phone is verified, and whether WhatsApp verification is set up. */
export async function GET(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  const [row] = await db().select({ ok: schema.users.phoneVerified }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  return Response.json({ verified: !!row?.ok, whatsapp: whatsappReady() });
}

/** A new code to send on WhatsApp, with the link that opens the chat with it typed in. */
export async function POST(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  if (!whatsappReady()) return Response.json({ error: "WhatsApp verification isn't set up yet." }, { status: 503 });
  try {
    return Response.json(await newCode(userId));
  } catch (e) {
    console.error("phone code failed", e);
    return Response.json({ error: "Couldn't make a code just now. Please try again." }, { status: 503 });
  }
}
