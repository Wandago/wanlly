import { optOut, unsubToken } from "@/lib/nudges";
import { SITE_URL } from "@/lib/site";

/*
 * Unsubscribe from come-back emails. The link in each email (and the List-Unsubscribe header,
 * which Gmail and others POST to with one click) carries the address and a signature, so only
 * the person who got the email can turn them off for that address.
 */

function valid(url: URL) {
  const email = (url.searchParams.get("e") ?? "").trim().toLowerCase();
  const token = url.searchParams.get("t") ?? "";
  return email.includes("@") && email.length < 200 && token === unsubToken(email) ? email : null;
}

const page = (title: string, text: string) =>
  new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · Wanlly</title></head><body style="margin:0;background:#0e0f12;color:#f2f2f3;font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh"><main style="max-width:440px;padding:24px;text-align:center"><h1 style="font-size:24px;margin:0 0 8px">${title}</h1><p style="color:#a3a5ad;margin:0 0 20px">${text}</p><a href="${SITE_URL}" style="color:#ff5a1f">Back to Wanlly</a></main></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

export async function GET(req: Request) {
  const email = valid(new URL(req.url));
  if (!email) return page("That link didn't work", "It may be incomplete. Reply to any Wanlly email and we'll take you off the list.");
  await optOut(email);
  return page("You're unsubscribed", `We won't send reminder emails to ${email.replace(/[<>&"]/g, "")} again. Account emails, like sign-in codes, still arrive.`);
}

// One-click unsubscribe from the email app (RFC 8058).
export async function POST(req: Request) {
  const email = valid(new URL(req.url));
  if (!email) return new Response("bad link", { status: 400 });
  await optOut(email);
  return new Response("ok");
}
