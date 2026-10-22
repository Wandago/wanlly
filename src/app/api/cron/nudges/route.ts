import { timingSafeEqual } from "node:crypto";
import { rawSql } from "@/db";
import { sendPendingAnnouncements } from "@/lib/announcements";
import { dailyArticleRun } from "@/lib/articles";
import { sendNudges } from "@/lib/nudges";

/*
 * Called every hour by the Worker's cron. Each run sends a batch of any announcement that's going
 * out; the day's Learn article is written in the 04:00 UTC run (07:00 in Nairobi), when switched on;
 * come-back emails go once a day, in the 07:00 UTC run (10:00 in Nairobi). Called (workers/site/entry.js), with CRON_SECRET (or, when that
 * isn't set, the Clerk secret, which the Worker already has) as a bearer token. Sends what's due
 * only while Admin → Beta → Come-back emails is switched on.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET || process.env.CLERK_SECRET_KEY || "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok = !!secret && got.length === secret.length && timingSafeEqual(Buffer.from(got), Buffer.from(secret));
  if (!ok) return new Response("forbidden", { status: 403 });
  const announcements = await sendPendingAnnouncements().catch((e) => (console.error("cron announcements failed", e), []));
  if (new Date().getUTCHours() === 4) {
    const article = await dailyArticleRun().catch((e) => (console.error("cron article failed", e instanceof Error ? e.message : e), `failed: ${e instanceof Error ? e.message : e}`));
    return Response.json({ announcements, article });
  }
  if (new Date().getUTCHours() !== 7) return Response.json({ announcements });
  const on = await rawSql()`select coalesce((select value = 'true'::jsonb from app_flags where key = 'nudgesAuto'), false) as on`
    .then((r) => (r as { on: boolean }[])[0]?.on === true)
    .catch(() => false);
  if (!on) return Response.json({ announcements, nudges: "off" });
  return Response.json({ announcements, nudges: await sendNudges() });
}
