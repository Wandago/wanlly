"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { DISPLAY_SIZES, VIDEO_ASPECTS, type DisplaySize, type VideoAspect } from "@/lib/ads";
import type { Sponsor } from "@/lib/catalog";
import { Cover } from "./cover";

/* Mock creatives. In production these boxes are filled by the ad network or a sponsor's own file;
   only the frame around them (label, size, spacing) is ours. */

export function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function SponsorMark({ sponsor, size }: { sponsor: Sponsor; size: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[25%] bg-white/95 font-bold"
      style={{ width: size, height: size, color: sponsor.color, fontSize: size * 0.45 }}
      aria-hidden="true"
    >
      {sponsor.initial}
    </span>
  );
}

/** A banner drawn at its exact pixel size, the way a network would deliver it. */
/** A sold campaign's own banner at this size, when they uploaded one; otherwise null. */
export function campaignBanner(sponsor: Sponsor, size: string): string | null {
  return sponsor.campaignId && sponsor.banners?.includes(size) ? `/api/ads/banner/${sponsor.campaignId}/${size}` : null;
}

export function DisplayCreative({ size, sponsor }: { size: DisplaySize; sponsor: Sponsor }) {
  const { w, h } = DISPLAY_SIZES[size];
  // A sold campaign's own banner at this size, when they uploaded one.
  const own = campaignBanner(sponsor, size);
  // eslint-disable-next-line @next/next/no-img-element
  if (own) return <img src={own} alt={`${sponsor.name}: ${sponsor.headline}`} width={w} height={h} style={{ width: w, height: h }} className="block" />;
  const bg = { width: w, height: h, background: `linear-gradient(140deg, ${sponsor.color}, color-mix(in srgb, ${sponsor.color} 55%, #000))` };
  const cta = (small: boolean) => (
    <span className={`shrink-0 rounded-full bg-white font-semibold whitespace-nowrap ${small ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-1.5 text-[13px]"}`} style={{ color: sponsor.color }}>
      {sponsor.cta}
    </span>
  );

  if (h <= 100) {
    return (
      <div className="flex items-center gap-2.5 overflow-hidden rounded-md px-3 text-white" style={bg}>
        <SponsorMark sponsor={sponsor} size={h <= 50 ? 26 : 40} />
        <div className="min-w-0 flex-1 leading-tight">
          {h > 50 && <div className="text-[11px] opacity-80">{sponsor.name}</div>}
          <div className={`font-semibold ${h > 50 ? "text-[15px]" : "truncate text-[13px]"}`}>{sponsor.headline}</div>
        </div>
        {cta(h <= 50)}
      </div>
    );
  }

  const tall = h >= 600;
  const narrow = w < 200;
  // Medium and tall banners lead with the sponsor's cover image, like most real creatives.
  if (!narrow && (tall || h >= 250)) {
    return (
      <div className="flex flex-col overflow-hidden rounded-md bg-white text-[#15171c]" style={{ width: w, height: h }}>
        <Cover sponsor={sponsor} className={tall ? "" : "h-[122px]"} />
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-3.5">
          <span className="text-[11px] font-semibold" style={{ color: sponsor.color }}>
            {sponsor.name}
          </span>
          <div className={`font-display leading-[1.08] font-semibold tracking-[-0.02em] ${tall ? "text-[26px]" : "text-[17px]"}`}>{sponsor.headline}</div>
          {tall && <p className="text-[13px] leading-snug text-[#5b6170]">{sponsor.text}</p>}
          <span className="mt-auto self-start rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-white" style={{ background: sponsor.color }}>
            {sponsor.cta}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 overflow-hidden rounded-md p-4 text-white" style={bg}>
      <div className="flex items-center gap-2">
        <SponsorMark sponsor={sponsor} size={28} />
        <span className="text-[13px] font-semibold">{sponsor.name}</span>
      </div>
      <div className={`font-display leading-[1.05] font-semibold tracking-[-0.02em] ${narrow ? "text-[22px]" : tall ? "text-[32px]" : "text-[24px]"}`}>{sponsor.headline}</div>
      {tall && <div className="min-h-0 flex-1 rounded bg-[repeating-linear-gradient(45deg,rgb(255_255_255/0.14)_0_10px,rgb(255_255_255/0.06)_10px_20px)]" />}
      {(tall || h >= 250) && !narrow && <p className="text-[13px] leading-snug opacity-85">{sponsor.text}</p>}
      <div className="mt-auto">{cta(narrow)}</div>
    </div>
  );
}

/**
 * A video spot in any of the three shapes. The frame keeps full width and caps its height;
 * the video sits centered with a blurred fill on either side, so vertical spots never stretch.
 */
export function VideoFrame({ aspect, sponsor, maxHeight }: { aspect: VideoAspect; sponsor: Sponsor; maxHeight?: number }) {
  const a = VIDEO_ASPECTS[aspect];
  const fill = `linear-gradient(150deg, ${sponsor.color}, color-mix(in srgb, ${sponsor.color} 40%, #000))`;
  const vertical = aspect === "9:16";
  return (
    <div className="@container relative w-full overflow-hidden bg-black" style={{ aspectRatio: a.ratio, maxHeight: maxHeight ?? a.maxHeight }}>
      <div className="absolute inset-0 scale-125 opacity-60 blur-2xl" style={{ background: fill }} aria-hidden="true" />
      <div
        className="relative mx-auto flex h-full max-w-full flex-col justify-end gap-1 p-4 text-white"
        style={{ aspectRatio: a.ratio, background: fill }}
      >
        <span className="absolute top-3 left-3 rounded-md bg-black/35 px-2 py-0.5 text-[11px] tracking-[0.08em] uppercase">Sponsored</span>
        <span className="absolute top-3 right-3 rounded-md bg-black/35 px-2 py-0.5 font-mono text-[11px]">{aspect}</span>
        <SponsorMark sponsor={sponsor} size={vertical ? 36 : 30} />
        <b className={`font-display leading-[1.05] font-semibold tracking-[-0.02em] ${vertical ? "text-[22px]" : "text-[clamp(18px,4cqi,28px)]"}`}>{sponsor.headline}</b>
        <small className="text-[13px] opacity-80">{sponsor.name}</small>
      </div>
    </div>
  );
}
