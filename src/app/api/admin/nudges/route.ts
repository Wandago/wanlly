import { rawSql } from "@/db";
import { CAN, logAction, requireStaff } from "@/lib/admin";
import { mailReady } from "@/lib/mail";
import { MAX_PER_RUN, dueNudges, nudgeStats, sendNudges } from "@/lib/nudges";

/** Admin → Beta → Come-back emails: who's due one now (with the email itself), totals, and whether they go out daily. */
export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.beta);
  if (staff instanceof Response) return staff;
  try {
    const due = await dueNudges();
    const auto = await rawSql()`select coalesce((select value = 'true'::jsonb from app_flags where key = 'nudgesAuto'), false) as on`.then((r) => (r as { on: boolean }[])[0]?.on === true);
    return Response.json({
      auto,
      mailReady: mailReady(),
      perRun: MAX_PER_RUN,
      stats: await nudgeStats(),
      due: due.map((n) => ({ kind: n.kind, email: n.email, subject: n.subject, text: n.text, html: n.html })),
    });
  } catch (e) {
    console.error("admin nudges GET failed", e);
    return Response.json({ error: "Couldn't load come-back emails." }, { status: 500 });
  }
}

/** Sends the next batch now. */
export async function POST(req: Request) {
  const staff = await requireStaff(req, CAN.beta);
  if (staff instanceof Response) return staff;
  const result = await sendNudges();
  await logAction(staff.id, "nudges.send", "", result).catch(() => {});
  return Response.json(result);
}
