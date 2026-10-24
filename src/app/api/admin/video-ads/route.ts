import { CAN, logAction, requireStaff } from "@/lib/admin";
import { smallJson } from "@/lib/forms";
import { allVideos, createVideo, videoFields } from "@/lib/video-ads";

/** Wanlly's own video ads, with plays and completions. */
export async function GET(req: Request) {
  const staff = await requireStaff(req, CAN.view);
  if (staff instanceof Response) return staff;
  try {
    return Response.json({ videos: await allVideos(), canEdit: (CAN.advertisers as readonly string[]).includes(staff.role) });
  } catch (e) {
    console.error("video ads GET failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}

/** Adds a video ad (live straight away). */
export async function POST(req: Request) {
  const staff = await requireStaff(req, CAN.advertisers);
  if (staff instanceof Response) return staff;
  const data = await smallJson(req);
  const v = data ? videoFields(data) : "Bad request";
  if (typeof v === "string") return Response.json({ error: v }, { status: 400 });
  const id = await createVideo(v);
  await logAction(staff.id, "video_ad.create", `video:${id}`, { title: v.title, url: v.url });
  return Response.json({ id });
}
