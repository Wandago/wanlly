import { CAN, logAction, requireStaff } from "@/lib/admin";
import { smallJson } from "@/lib/forms";
import { deleteVideo, setVideoActive, updateVideo, videoFields } from "@/lib/video-ads";

/** Edits a video ad, or switches it on or off ({ active }). */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/video-ads/[id]">) {
  const staff = await requireStaff(req, CAN.advertisers);
  if (staff instanceof Response) return staff;
  const id = Number((await ctx.params).id);
  const data = await smallJson(req);
  if (!Number.isSafeInteger(id) || !data) return Response.json({ error: "Bad request" }, { status: 400 });
  if (typeof data.active === "boolean" && Object.keys(data).length === 1) {
    await setVideoActive(id, data.active);
    await logAction(staff.id, data.active ? "video_ad.on" : "video_ad.off", `video:${id}`);
    return Response.json({ ok: true });
  }
  const v = videoFields(data);
  if (typeof v === "string") return Response.json({ error: v }, { status: 400 });
  await updateVideo(id, v);
  await logAction(staff.id, "video_ad.edit", `video:${id}`, { title: v.title, url: v.url });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/admin/video-ads/[id]">) {
  const staff = await requireStaff(req, CAN.advertisers);
  if (staff instanceof Response) return staff;
  const id = Number((await ctx.params).id);
  if (!Number.isSafeInteger(id)) return Response.json({ error: "Bad request" }, { status: 400 });
  await deleteVideo(id);
  await logAction(staff.id, "video_ad.delete", `video:${id}`);
  return Response.json({ ok: true });
}
