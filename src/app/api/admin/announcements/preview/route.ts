import { CAN, requireStaff } from "@/lib/admin";
import { renderAnnouncement } from "@/lib/announcements";
import { field, smallJson } from "@/lib/forms";

/** The announcement email as it will look, while it's being written. */
export async function POST(req: Request) {
  const staff = await requireStaff(req, CAN.beta);
  if (staff instanceof Response) return staff;
  const d = (await smallJson(req)) ?? {};
  const subject = field(d, "subject", 140) || "Subject";
  const m = renderAnnouncement(
    { subject, heading: field(d, "heading", 140) || subject, body: typeof d.body === "string" ? d.body.slice(0, 6000) : "", buttonLabel: field(d, "buttonLabel", 40) || null, buttonUrl: field(d, "buttonUrl", 500) || null },
    "you@example.com",
  );
  return Response.json({ html: m.html });
}
