import { CAN, logAction, requireStaff } from "@/lib/admin";
import { AUDIENCES, type Audience, audienceCounts, ensureAnnouncements, listAnnouncements } from "@/lib/announcements";
import { rawSql } from "@/db";
import { field, smallJson } from "@/lib/forms";
import { mailReady } from "@/lib/mail";

/** Announcements: the list, how many each audience reaches, and whether email works. */
export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.beta);
  if (staff instanceof Response) return staff;
  try {
    return Response.json({ announcements: await listAnnouncements(), counts: await audienceCounts(), mailReady: mailReady() });
  } catch (e) {
    console.error("announcements GET failed", e);
    return Response.json({ error: "Couldn't load announcements." }, { status: 500 });
  }
}

/** Saves a new announcement as a draft. */
export async function POST(req: Request) {
  const staff = await requireStaff(req, CAN.beta);
  if (staff instanceof Response) return staff;
  const d = await smallJson(req);
  if (!d) return Response.json({ error: "Bad request" }, { status: 400 });
  const subject = field(d, "subject", 140);
  const heading = field(d, "heading", 140) || subject;
  const body = typeof d.body === "string" ? d.body.trim().slice(0, 6000) : "";
  const buttonLabel = field(d, "buttonLabel", 40) || null;
  let buttonUrl = field(d, "buttonUrl", 500) || null;
  if (buttonUrl && !/^https:\/\//.test(buttonUrl)) buttonUrl = null;
  const audience = (AUDIENCES as readonly string[]).includes(String(d.audience)) ? (d.audience as Audience) : "users";
  if (subject.length < 4 || body.length < 20) return Response.json({ error: "Add a subject and a message of a couple of sentences." }, { status: 400 });
  await ensureAnnouncements();
  const [row] = (await rawSql()`insert into announcements (subject, heading, body, button_label, button_url, audience, created_by)
    values (${subject}, ${heading}, ${body}, ${buttonLabel}, ${buttonLabel ? buttonUrl : null}, ${audience}, ${staff.id}) returning id`) as { id: number }[];
  await logAction(staff.id, "announcement.draft", `announcement:${row.id}`, { subject, audience });
  return Response.json({ id: Number(row.id) });
}
