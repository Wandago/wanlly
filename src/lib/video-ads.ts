import "server-only";
import { rawSql } from "@/db";
import { VIDEO_MAX_MS, VIDEO_MIN_MS, type HouseVideo, type VideoAspect } from "./ads";

/*
 * Wanlly's own video ads: MP4s the team adds in Admin → Advertisers → Video ads. Active ones play
 * in the rewarded spots (earn credits, before a run, the Builder), taking turns. The file itself is
 * served from public/ads or any direct https link, never through the database.
 */

export type VideoAdRow = HouseVideo & { active: boolean; createdAt: string; plays: number; completions: number };
const ASPECTS: VideoAspect[] = ["16:9", "9:16", "1:1"];

let ready = false;
export async function ensureVideoAds() {
  if (ready) return;
  await rawSql()`create table if not exists video_ads (
    id bigserial primary key, title text not null, brand text not null, url text not null, aspect text not null,
    duration_ms int not null, cta text not null default 'Learn more', link text not null default '',
    active boolean not null default true, created_at timestamptz not null default now())`;
  ready = true;
}

const row = (r: Record<string, unknown>): HouseVideo => ({
  id: Number(r.id),
  title: String(r.title),
  brand: String(r.brand),
  url: String(r.url),
  aspect: (ASPECTS as string[]).includes(String(r.aspect)) ? (r.aspect as VideoAspect) : "16:9",
  durationMs: Number(r.duration_ms),
  cta: String(r.cta ?? "Learn more"),
  link: String(r.link ?? ""),
});

/** The videos that may play now. */
export async function activeVideos(): Promise<HouseVideo[]> {
  await ensureVideoAds();
  return ((await rawSql()`select * from video_ads where active order by id desc limit 20`) as Record<string, unknown>[]).map(row);
}

/** Every video, with how often it started and played to the end, for the admin page. */
export async function allVideos(): Promise<VideoAdRow[]> {
  await ensureVideoAds();
  const rows = (await rawSql()`select v.*,
      (select count(*) from ad_events e where e.creative = 'video:' || v.id and e.kind = 'reward_started')::int as plays,
      (select count(*) from ad_events e where e.creative = 'video:' || v.id and e.kind = 'reward_completed')::int as completions
    from video_ads v order by v.id desc`) as Record<string, unknown>[];
  return rows.map((r) => ({ ...row(r), active: r.active === true, createdAt: new Date(String(r.created_at)).toISOString(), plays: Number(r.plays), completions: Number(r.completions) }));
}

/** How long an active video runs, or null when it isn't one. */
export async function videoLength(id: number): Promise<number | null> {
  await ensureVideoAds();
  const [r] = (await rawSql()`select duration_ms from video_ads where id = ${id} and active`) as { duration_ms: number }[];
  return r ? Number(r.duration_ms) : null;
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** A video ad from the admin form, checked; or the reason it can't be saved. */
export function videoFields(data: Record<string, unknown>): Omit<HouseVideo, "id"> | string {
  const url = clean(data.url, 500);
  const link = clean(data.link, 500);
  const aspect = ASPECTS.find((a) => a === data.aspect);
  const durationMs = Math.round(Number(data.durationMs));
  if (!/^(https:\/\/[^\s]+|\/ads\/[\w.-]+)\.mp4(\?[^\s]*)?$/i.test(url)) return "The video must be an .mp4: a file in public/ads (like /ads/promo.mp4) or a direct https link.";
  if (link && !/^https:\/\/[^\s]+$/.test(link)) return "The button link must start with https://";
  if (!aspect) return "Pick the video's shape.";
  if (!Number.isFinite(durationMs) || durationMs < VIDEO_MIN_MS || durationMs > VIDEO_MAX_MS) return `Video ads must be ${VIDEO_MIN_MS / 1000} to ${VIDEO_MAX_MS / 1000} seconds long.`;
  const title = clean(data.title, 80);
  const brand = clean(data.brand, 60);
  if (!title || !brand) return "Give it a title and a brand name.";
  return { title, brand, url, aspect, durationMs, cta: clean(data.cta, 30) || "Learn more", link };
}

export async function createVideo(v: Omit<HouseVideo, "id">): Promise<number> {
  await ensureVideoAds();
  const [r] = (await rawSql()`insert into video_ads (title, brand, url, aspect, duration_ms, cta, link)
    values (${v.title}, ${v.brand}, ${v.url}, ${v.aspect}, ${v.durationMs}, ${v.cta}, ${v.link}) returning id`) as { id: number }[];
  return Number(r.id);
}

export async function updateVideo(id: number, v: Omit<HouseVideo, "id">) {
  await ensureVideoAds();
  await rawSql()`update video_ads set title = ${v.title}, brand = ${v.brand}, url = ${v.url}, aspect = ${v.aspect},
    duration_ms = ${v.durationMs}, cta = ${v.cta}, link = ${v.link} where id = ${id}`;
}

export async function setVideoActive(id: number, active: boolean) {
  await ensureVideoAds();
  await rawSql()`update video_ads set active = ${active} where id = ${id}`;
}

export async function deleteVideo(id: number) {
  await ensureVideoAds();
  await rawSql()`delete from video_ads where id = ${id}`;
}
