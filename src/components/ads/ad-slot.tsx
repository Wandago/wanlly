"use client";

import { useEffect, useRef, useState } from "react";
import { DISPLAY_SIZES, PLACEMENT_SIZES, pickSize, type VideoAspect } from "@/lib/ads";
import { SPOT_REWARD, SPOT_SECONDS, type Sponsor } from "@/lib/catalog";
import { useWorkspace } from "@/lib/workspace-store";
import { Icon } from "../icon";
import { DisplayCreative, VideoFrame, useWidth } from "./creatives";

const eyebrow = "text-[11px] uppercase tracking-[0.07em] text-faint";

function Logo({ sponsor, small = false }: { sponsor: Sponsor; small?: boolean }) {
  return (
    <span
      className={`grid shrink-0 place-items-center font-bold text-white ${small ? "size-5 rounded-md text-[10px]" : "size-[34px] rounded-[10px] text-sm"}`}
      style={{ background: sponsor.color }}
      aria-hidden="true"
    >
      {sponsor.initial}
    </span>
  );
}

/** Placeholder for the sponsor's link until real ad sources are wired up. */
function SponsorLink({ sponsor, className }: { sponsor: Sponsor; className: string }) {
  const { dispatch } = useWorkspace();
  return (
    <button type="button" className={className} onClick={() => dispatch({ type: "toast", text: `Opens ${sponsor.name} in a new tab` })}>
      {sponsor.cta}
    </button>
  );
}

export function WatchButton({ onClick, earned = false, className = "" }: { onClick?: () => void; earned?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={earned}
      className={`flex items-center gap-[7px] rounded-[9px] px-3 py-[7px] text-[13px] font-semibold ${earned ? "bg-hover text-good" : "bg-fg text-bg"} ${className}`}
    >
      {earned ? (
        <>
          <Icon name="check" size={15} />+{SPOT_REWARD} earned
        </>
      ) : (
        <>
          <Icon name="play" size={15} />
          Watch 20s <span className="font-mono font-medium text-accent">+{SPOT_REWARD}</span>
        </>
      )}
    </button>
  );
}

/** A video spot with its progress track. `progress` is 0 to 1. */
export function VideoSpot({ aspect, sponsor, progress, maxHeight }: { aspect: VideoAspect; sponsor: Sponsor; progress: number; maxHeight?: number }) {
  const secs = Math.floor(progress * SPOT_SECONDS);
  return (
    <div>
      <VideoFrame aspect={aspect} sponsor={sponsor} maxHeight={maxHeight} />
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 font-mono text-[13px] text-muted">
        <span className="tabular-nums">0:0{secs}</span>
        <div
          className="h-1 flex-1 overflow-hidden rounded-full bg-hover"
          role="progressbar"
          aria-label="Sponsor spot progress"
          aria-valuemin={0}
          aria-valuemax={SPOT_SECONDS}
          aria-valuenow={secs}
        >
          <i className="block h-full rounded-full bg-accent" style={{ width: `${progress * 100}%` }} />
        </div>
        <span>+{SPOT_REWARD}</span>
      </div>
    </div>
  );
}

/** A spot that plays wherever it's mounted, then calls onDone once. */
export function RewardedSpot({ aspect, sponsor, onDone, maxHeight }: { aspect: VideoAspect; sponsor: Sponsor; onDone: () => void; maxHeight?: number }) {
  const [progress, setProgress] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const start = Date.now();
    const iv = window.setInterval(() => {
      const f = Math.min(1, (Date.now() - start) / 1000 / SPOT_SECONDS);
      setProgress(f);
      if (f >= 1) {
        window.clearInterval(iv);
        done.current();
      }
    }, 100);
    return () => window.clearInterval(iv);
  }, []);

  return <VideoSpot aspect={aspect} sponsor={sponsor} progress={progress} maxHeight={maxHeight} />;
}

/** Asks for the largest standard size that fits, the way a network's size mapping does. */
function FittedDisplay({ sizes, sponsor, align = "center" }: { sizes: (keyof typeof DISPLAY_SIZES)[]; sponsor: Sponsor; align?: "center" | "start" }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const size = width ? pickSize(sizes, width) : null;
  return (
    <div ref={ref} className={`flex w-full ${align === "center" ? "justify-center" : "justify-start"}`}>
      {size ? (
        <div className="flex flex-col gap-1">
          <DisplayCreative size={size} sponsor={sponsor} />
          <span className="font-mono text-[10px] text-faint">{size}</span>
        </div>
      ) : (
        <div style={{ height: width ? 0 : DISPLAY_SIZES[sizes[sizes.length - 1]].h }} />
      )}
    </div>
  );
}

export type CardFormat = "native" | "display";
export type SpotState = "idle" | "playing" | "earned";

/**
 * The working-card slot. Same frame in every tool; inside it, a native ad, a fitted display
 * banner, or a playing spot. Previews pass `progress` to freeze a spot at that point.
 */
export function SponsorCard({
  sponsor,
  format,
  spot,
  spotAspect,
  onWatch,
  onSpotDone,
  progress,
}: {
  sponsor: Sponsor;
  format: CardFormat;
  spot: SpotState;
  spotAspect: VideoAspect;
  onWatch?: () => void;
  onSpotDone?: () => void;
  progress?: number;
}) {
  if (spot === "playing") {
    return (
      <div className="animate-rise overflow-hidden rounded-2xl border border-line bg-surface">
        {progress !== undefined ? (
          <VideoSpot aspect={spotAspect} sponsor={sponsor} progress={progress} />
        ) : (
          <RewardedSpot aspect={spotAspect} sponsor={sponsor} onDone={() => onSpotDone?.()} />
        )}
      </div>
    );
  }

  return (
    <div className="animate-rise overflow-hidden rounded-2xl border border-line bg-surface">
      {format === "native" ? (
        <div className="flex items-start gap-3 p-3.5">
          <Logo sponsor={sponsor} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={eyebrow}>While you wait · Sponsored</span>
            <b className="font-semibold">{sponsor.name}</b>
            <p className="text-sm text-muted">{sponsor.text}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 p-3.5">
          <span className={eyebrow}>While you wait · Sponsored</span>
          <div className="rounded-xl bg-code px-2 py-4">
            <FittedDisplay sizes={PLACEMENT_SIZES.card} sponsor={sponsor} />
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3.5 py-2.5">
        {format === "native" && (
          <SponsorLink
            sponsor={sponsor}
            className="rounded-[9px] border border-line bg-surface px-[11px] py-[7px] text-[13px] font-medium hover:border-faint"
          />
        )}
        <WatchButton onClick={onWatch} earned={spot === "earned"} className="ml-auto" />
      </div>
    </div>
  );
}

/** What the card folds into once the result is in: one native line, or a 320×50 banner. */
export function SponsorLine({ sponsor, format, earned }: { sponsor: Sponsor; format: CardFormat; earned: boolean }) {
  const badge = earned && (
    <span className="rounded-full bg-good/12 px-[7px] py-0.5 font-mono text-[11px] text-good">+{SPOT_REWARD} earned</span>
  );
  if (format === "display") {
    return (
      <div className="flex animate-rise flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <span className={eyebrow}>Sponsored</span>
          {badge}
        </div>
        <FittedDisplay sizes={PLACEMENT_SIZES.line} sponsor={sponsor} align="start" />
      </div>
    );
  }
  return (
    <div className="flex min-w-0 animate-rise flex-wrap items-center gap-2.5 py-0.5 text-[13px] text-muted">
      <Logo sponsor={sponsor} small />
      <span className={eyebrow}>Sponsored</span>
      <span>
        <b className="font-semibold text-fg">{sponsor.name}</b> ·{" "}
        <SponsorLink sponsor={sponsor} className="text-fg underline decoration-line underline-offset-[3px] hover:decoration-faint" />
      </span>
      {badge}
    </div>
  );
}

/** Tall ad for the empty right side in Code on screens 1440px and wider. */
export function RailAd({ sponsor }: { sponsor: Sponsor }) {
  return (
    <aside className="sticky top-4 flex flex-col gap-1.5" aria-label="Sponsored">
      <span className={eyebrow}>Sponsored</span>
      <FittedDisplay sizes={PLACEMENT_SIZES.rail} sponsor={sponsor} align="start" />
    </aside>
  );
}
