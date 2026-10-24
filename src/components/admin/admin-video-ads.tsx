"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VIDEO_MAX_MS, VIDEO_MIN_MS, type VideoAspect } from "@/lib/ads";
import { Card, Empty, Loading, api, btnDark, btnGhost, num } from "./admin-ui";

type Video = { id: number; title: string; brand: string; url: string; aspect: VideoAspect; durationMs: number; cta: string; link: string; active: boolean; plays: number; completions: number };
type Form = { id?: number; title: string; brand: string; url: string; cta: string; link: string; aspect: VideoAspect | ""; durationMs: number };
const EMPTY: Form = { title: "", brand: "Wanlly", url: "", cta: "Learn more", link: "https://wanlly.africa", aspect: "", durationMs: 0 };

/** The nearest of the three spot shapes to a video's own width and height. */
function shapeOf(w: number, h: number): VideoAspect {
  const r = w / h;
  return r > 1.3 ? "16:9" : r < 0.77 ? "9:16" : "1:1";
}

const field = "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-faint";

/** Wanlly's own MP4 ads for the rewarded spots: add one by its address, check it plays, switch it on or off. */
export function VideoAdsCard() {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [note, setNote] = useState("");
  const [probe, setProbe] = useState("");
  const [busy, setBusy] = useState(false);
  const preview = useRef<HTMLVideoElement>(null);

  const load = useCallback(() => {
    api<{ videos: Video[]; canEdit: boolean }>("/api/admin/video-ads")
      .then((d) => {
        setVideos(d.videos);
        setCanEdit(d.canEdit);
      })
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(load, [load]);

  const set = (k: keyof Form, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));
  // Reads the length and shape from the video itself once its address loads.
  const onMeta = () => {
    const v = preview.current;
    if (!v || !form) return;
    const ms = Math.round(v.duration * 1000);
    setForm({ ...form, durationMs: ms, aspect: shapeOf(v.videoWidth, v.videoHeight) });
    setProbe(ms < VIDEO_MIN_MS || ms > VIDEO_MAX_MS ? `This video is ${(ms / 1000).toFixed(1)}s. Video ads must be ${VIDEO_MIN_MS / 1000}–${VIDEO_MAX_MS / 1000} seconds; 15–20 works best.` : `✓ ${(ms / 1000).toFixed(1)} seconds, ${v.videoWidth}×${v.videoHeight}`);
  };

  const save = async () => {
    if (!form) return;
    setBusy(true);
    setNote("");
    try {
      const body = { title: form.title, brand: form.brand, url: form.url, cta: form.cta, link: form.link, aspect: form.aspect, durationMs: form.durationMs };
      if (form.id) await api(`/api/admin/video-ads/${form.id}`, "PATCH", body);
      else await api("/api/admin/video-ads", "POST", body);
      setForm(null);
      setProbe("");
      setNote("✓ Saved. It plays in the rewarded spots from the next page load.");
      load();
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (v: Video) => {
    try {
      await api(`/api/admin/video-ads/${v.id}`, "PATCH", { active: !v.active });
      load();
    } catch (e) {
      setNote((e as Error).message);
    }
  };
  const remove = async (v: Video) => {
    if (!window.confirm(`Delete "${v.title}"? (The MP4 file itself stays where it is.)`)) return;
    try {
      await api(`/api/admin/video-ads/${v.id}`, "DELETE");
      load();
    } catch (e) {
      setNote((e as Error).message);
    }
  };

  return (
    <Card
      title="Video ads"
      note="Wanlly's own MP4 ads. Active ones take turns in the rewarded spots (Earn credits, before a run, the Builder) whenever no sold campaign has booked that place, and pay credits only after playing to the end. Put the file in the site's public/ads folder (on GitHub: public/ads → Add file → Upload files) and use /ads/your-file.mp4, or paste any direct https link to an .mp4. Best: 15–20 seconds, MP4 (H.264), under 10 MB, 1920×1080, 1080×1920 or 1080×1080."
      actions={
        canEdit &&
        !form && (
          <button type="button" className={btnDark} onClick={() => (setForm({ ...EMPTY }), setProbe(""), setNote(""))}>
            Add video ad
          </button>
        )
      }
    >
      {form && (
        <form
          className="flex flex-col gap-3 rounded-xl bg-code p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="flex flex-col gap-1 text-xs text-muted">
            MP4 address
            <input value={form.url} onChange={(e) => (set("url", e.target.value.trim()), setProbe("Loading the video…"))} placeholder="/ads/wanlly-promo-16x9.mp4" className={field} />
          </label>
          {form.url && (
            // Muted so it can play here; also how the length and shape are read.
            <video ref={preview} key={form.url} src={form.url} muted controls playsInline preload="metadata" onLoadedMetadata={onMeta} onError={() => setProbe("That address didn't load as a video. Check the link, and that the file is an .mp4.")} className="max-h-[240px] w-full rounded-lg bg-black" />
          )}
          {probe && <p className={`text-[13px] ${probe.startsWith("✓") || probe.startsWith("Loading") ? "text-muted" : "text-bad"}`}>{probe}</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Title (for you)
              <input value={form.title} maxLength={80} onChange={(e) => set("title", e.target.value)} placeholder="Wanlly promo, vertical" className={field} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Brand shown on the ad
              <input value={form.brand} maxLength={60} onChange={(e) => set("brand", e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Button
              <input value={form.cta} maxLength={30} onChange={(e) => set("cta", e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Button link (https://, or empty for no button)
              <input value={form.link} maxLength={500} onChange={(e) => set("link", e.target.value.trim())} className={field} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">Shape:</span>
            {(["16:9", "9:16", "1:1"] as const).map((a) => (
              <button key={a} type="button" aria-pressed={form.aspect === a} onClick={() => set("aspect", a)} className={`rounded-full border px-2.5 py-0.5 text-xs ${form.aspect === a ? "border-accent-line bg-accent-soft text-accent" : "border-line text-muted"}`}>
                {a}
              </button>
            ))}
            <span className="text-xs text-faint">(read from the video; change it if it looks wrong)</span>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !form.durationMs || !form.aspect} className={btnDark}>
              {busy ? "Saving…" : form.id ? "Save changes" : "Add and switch on"}
            </button>
            <button type="button" className={btnGhost} onClick={() => (setForm(null), setProbe(""))}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {note && <p className={`text-[13px] ${note.startsWith("✓") ? "text-good" : "text-bad"}`}>{note}</p>}
      {error ? (
        <Empty>{error}</Empty>
      ) : !videos ? (
        <Loading />
      ) : videos.length === 0 ? (
        <Empty>No video ads yet. Until you add one, the rewarded spots show Wanlly&apos;s animated placeholder.</Empty>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {videos.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <video src={v.url} muted playsInline preload="metadata" className="h-14 w-24 shrink-0 rounded-md bg-black object-contain" />
              <div className="flex min-w-0 flex-1 flex-col">
                <b className={`truncate text-[13px] font-medium ${v.active ? "" : "text-faint line-through"}`}>{v.title}</b>
                <small className="truncate text-xs text-muted">
                  {v.brand} · {v.aspect} · {(v.durationMs / 1000).toFixed(0)}s · {num(v.plays)} plays · {num(v.completions)} watched to the end
                  {v.plays ? ` (${Math.round((v.completions / v.plays) * 100)}%)` : ""}
                </small>
                <small className="truncate font-mono text-[11px] text-faint">{v.url}</small>
              </div>
              {canEdit && (
                <div className="flex gap-1.5">
                  <button type="button" className={v.active ? btnGhost : btnDark} onClick={() => toggle(v)}>
                    {v.active ? "Switch off" : "Switch on"}
                  </button>
                  <button type="button" className={btnGhost} onClick={() => (setForm({ id: v.id, title: v.title, brand: v.brand, url: v.url, cta: v.cta, link: v.link, aspect: v.aspect, durationMs: v.durationMs }), setProbe(""))}>
                    Edit
                  </button>
                  <button type="button" className={btnGhost} onClick={() => remove(v)}>
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
