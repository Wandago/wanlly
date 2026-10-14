import { timingSafeEqual } from "node:crypto";
import { rawSql } from "@/db";
import { sendNudges } from "@/lib/nudges";

/*
 * Called once a day by the Worker's cron (workers/site/entry.js), with CRON_SECRET (or, when that
 * isn't set, the Clerk secret, which the Worker already has) as a bearer token. Sends what's due
 * only while Admin → Beta → Come-back emails is switched on.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET || process.env.CLERK_SECRET_KEY || "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok = !!secret && got.length === secret.length && timingSafeEqual(Buffer.from(got), Buffer.from(secret));
  if (!ok) return new Response("forbidden", { status: 403 });
  const on = await rawSql()`select coalesce((select value = 'true'::jsonb from app_flags where key = 'nudgesAuto'), false) as on`
    .then((r) => (r as { on: boolean }[])[0]?.on === true)
    .catch(() => false);
  if (!on) return Response.json({ skipped: "Come-back emails are off" });
  return Response.json(await sendNudges());
}
