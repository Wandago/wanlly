import { handleDelivery, signedByMeta } from "@/lib/whatsapp";

/** Meta's one-time check when the webhook is set up: echo the challenge if the token matches. */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === token) return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  return new Response("Forbidden", { status: 403 });
}

/** Incoming WhatsApp messages. Only deliveries signed with the app secret are read. */
export async function POST(req: Request) {
  const body = await req.text();
  if (body.length > 256_000) return new Response(null, { status: 413 });
  if (!(await signedByMeta(body, req.headers.get("x-hub-signature-256")))) return new Response("Invalid signature", { status: 401 });
  try {
    await handleDelivery(JSON.parse(body));
  } catch (e) {
    // Meta retries non-200 answers for days; log and accept, the person can send the code again.
    console.error("whatsapp webhook failed", e);
  }
  return new Response("ok");
}
