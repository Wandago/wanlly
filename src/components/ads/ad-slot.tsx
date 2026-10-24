"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { DISPLAY_SIZES, PLACEMENT_SIZES, VIDEO_ASPECTS, pickSize, type HouseVideo, type VideoAspect } from "@/lib/ads";
import { SPOT_SECONDS, SPOT_SPONSOR, type Sponsor } from "@/lib/catalog";
import { useReward, useWorkspace } from "@/lib/workspace-store";
import { openSponsor, useHouseVideo, useNetwork, useSponsors } from "@/lib/ads-context";
import { Icon } from "../icon";
import { openPhoneVerify } from "../phone-verify";
import { Cover } from "./cover";
import { DisplaySlot } from "./display-slot";
import { DisplayCreative, VideoFrame, useWidth } from "./creatives";
import { NetworkSlot, useNetworkTest } from "./network-slot";
import { NetworkUnit } from "./network-unit";
import type { NetworkSize } from "@/lib/ad-network";

const eyebrow = "text-[11px] uppercase tracking-[0.07em] text-faint";

function Logo({ sponsor, small = false }: { sponsor: Sponsor; small?: boolean }) {
  return (
    <span
      className={`grid shrink-0 place-items-center font-bold text-white ${small ? "size-5 rounded-md text-[10px]" : "size-[34px] rounded-[10px] text-[13px]"}`}
      style={{ background: sponsor.color }}
      aria-hidden="true"
    >
      {sponsor.initial}
    </span>
  );
}

/** The campaign's picture; tapping it opens their link like the button does. */
function CoverLink({ sponsor }: { sponsor: Sponsor }) {
  const { dispatch } = useWorkspace();
  return (
    <button
      type="button"
      aria-label={`${sponsor.name}: ${sponsor.cta}`}
      onClick={() => openSponsor(sponsor, "job_card") || dispatch({ type: "toast", text: `Opens ${sponsor.name} in a new tab` })}
      className="block shrink-0 overflow-hidden sm:w-[42%] sm:max-w-[300px]"
    >
      {sponsor.image ? (
        // Their whole picture, never cropped; the brand colour fills any gap.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sponsor.image} alt="" className="block h-auto w-full sm:h-full sm:min-h-[150px] sm:object-contain" style={{ background: sponsor.color }} />
      ) : (
        <Cover sponsor={sponsor} className="h-full sm:aspect-auto sm:min-h-[150px]" />
      )}
    </button>
  );
}

/** Placeholder for the sponsor's link until real ad sources are wired up. */
function SponsorLink({ sponsor, className }: { sponsor: Sponsor; className: string }) {
  const { dispatch } = useWorkspace();
  return (
    <button type="button" className={className} onClick={() => openSponsor(sponsor, "job_card") || dispatch({ type: "toast", text: `Opens ${sponsor.name} in a new tab` })}>
      {sponsor.cta}
    </button>
  );
}

export function WatchButton({ onClick, earned = false, className = "" }: { onClick?: () => void; earned?: boolean; className?: string }) {
  const { perAd: SPOT_REWARD } = useReward();
  return (
    <button
      type="button"
      data-ad-ignore
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
          Watch an ad <span className="font-mono font-medium text-accent">+{SPOT_REWARD}</span>
        </>
      )}
    </button>
  );
}

/** A video spot with its progress track. `progress` is 0 to 1. */
export function VideoSpot({ aspect, sponsor, progress, maxHeight }: { aspect: VideoAspect; sponsor: Sponsor; progress: number; maxHeight?: number }) {
  const { perAd: SPOT_REWARD } = useReward();
  const secs = Math.floor(progress * SPOT_SECONDS);
  return (
    <div>
      <VideoFrame aspect={aspect} sponsor={sponsor} maxHeight={maxHeight} />
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 font-mono text-[13px] text-muted">
        <span className="tabular-nums">{clock(secs)}</span>
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

export type Placement = "unlock" | "earn_dialog" | "gate" | "job_card";
/** What the server paid for a finished video, or null when it paid nothing. */
export type ViewResult = { earned: number; credits: number } | null;

async function postJson(url: string, body: object) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { ok: r.ok, body: await r.json().catch(() => ({})) };
}

const clock = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;

/** What a real video reports to the view while it plays. */
type MediaHooks = { onTime: (seconds: number, total: number) => void; onEnded: () => void; onFail: () => void };

/**
 * A server-checked rewarded view: starts a view when shown, and once the ad has played in full asks
 * the server to pay it. With one of Wanlly's own videos, progress follows the video itself (pausing
 * pauses it) and the server waits that video's whole length; otherwise a plain timer runs for
 * SPOT_SECONDS. `progress` runs from 0 to 1; `onDone` gets the result (null: not paid).
 */
function useRewardedView(placement: string, onDone: (result: ViewResult) => void, video: HouseVideo | null = null) {
  const { dispatch } = useWorkspace();
  const [progress, setProgress] = useState(0);
  // A video that can't load falls back to the timer, for the video's own length.
  const [timerMs, setTimerMs] = useState<number | null>(video ? null : SPOT_SECONDS * 1000);
  const done = useRef(onDone);
  const view = useRef<Promise<string | null> | null>(null);
  const finished = useRef(false);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  const finish = useCallback(() => {
    if (finished.current || !view.current) return;
    finished.current = true;
    setProgress(1);
    view.current
      .then(async (viewId) => {
        if (!viewId) return null;
        const { ok, body } = await postJson("/api/earn/complete", { viewId });
        if (!ok) {
          dispatch({ type: "toast", text: body.error ?? "Couldn't add those credits" });
          if (body.need === "phone") openPhoneVerify();
          return null;
        }
        const text = body.earned ? `+${body.earned} credits${body.bonus ? " · first ad today" : ""}` : undefined;
        dispatch({ type: "account", credits: body.credits, floorUnlocked: body.floorUnlocked, usage: body.usage, toast: text });
        return body.earned ? { earned: body.earned as number, credits: body.credits as number } : null;
      })
      .catch(() => {
        dispatch({ type: "toast", text: "You're offline. Those credits weren't added" });
        return null;
      })
      .then((r) => done.current(r));
  }, [dispatch]);

  useEffect(() => {
    // Once per mount, even when React runs effects twice in development.
    view.current ??= postJson("/api/earn/start", { placement, ...(video ? { creative: `video:${video.id}` } : {}) })
      .then(({ ok, body }) => {
        if (ok) return body.viewId as string;
        dispatch({ type: "toast", text: body.error ?? "Couldn't start the ad" });
        // Past the first video of the day, earning needs a verified phone (one WhatsApp message).
        if (body.need === "phone") openPhoneVerify();
        return null;
      })
      .catch(() => null);
  }, [placement, video, dispatch]);

  useEffect(() => {
    if (timerMs === null) return;
    const start = Date.now();
    const iv = window.setInterval(() => {
      const f = Math.min(1, (Date.now() - start) / timerMs);
      setProgress(f);
      if (f < 1) return;
      window.clearInterval(iv);
      finish();
    }, 100);
    return () => window.clearInterval(iv);
  }, [timerMs, finish]);

  const media: MediaHooks = {
    onTime: (seconds, total) => {
      if (total > 0 && !finished.current) setProgress(Math.min(0.999, seconds / total));
    },
    onEnded: finish,
    onFail: () => {
      if (video && timerMs === null && !finished.current) setTimerMs(video.durationMs);
    },
  };
  return { progress, media, failed: !!video && timerMs !== null };
}

/**
 * One of Wanlly's own MP4 ads, playing in a spot. It starts muted (browsers only autoplay muted
 * video) with a sound button, can't be skipped or scrubbed, and its button opens the advertiser's
 * link in a new tab.
 */
export function HouseVideoSpot({ video, progress, media, maxHeight }: { video: HouseVideo; progress: number; media: MediaHooks; maxHeight?: number }) {
  const { perAd: SPOT_REWARD } = useReward();
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [stuck, setStuck] = useState(false);
  const a = VIDEO_ASPECTS[video.aspect];
  const total = video.durationMs / 1000;
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = muted;
  }, [muted]);
  // Autoplay can be blocked (a phone's low-power mode): then a tap starts it.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (ref.current && ref.current.paused && ref.current.currentTime === 0) setStuck(true);
    }, 2500);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div>
      <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: a.ratio, maxHeight: maxHeight ?? a.maxHeight }}>
        <video
          ref={ref}
          src={video.url}
          autoPlay
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          controlsList="nodownload noplaybackrate noremoteplayback"
          onContextMenu={(e) => e.preventDefault()}
          onPlaying={() => setStuck(false)}
          onTimeUpdate={(e) => media.onTime(e.currentTarget.currentTime, e.currentTarget.duration || total)}
          onEnded={media.onEnded}
          onError={media.onFail}
          className="absolute inset-0 h-full w-full object-contain"
        />
        <span className="absolute top-3 left-3 rounded-md bg-black/45 px-2 py-0.5 text-[11px] tracking-[0.08em] text-white uppercase">Sponsored · {video.brand}</span>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Turn the sound on" : "Turn the sound off"}
          className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full bg-black/45 text-[15px] text-white hover:bg-black/60"
        >
          {muted ? "🔇" : "🔊"}
        </button>
        {stuck && (
          <button type="button" onClick={() => void ref.current?.play()} className="absolute inset-0 grid place-items-center bg-black/40 text-white" aria-label="Play the ad">
            <span className="grid size-14 place-items-center rounded-full bg-white/90 text-black">
              <Icon name="play" size={22} />
            </span>
          </button>
        )}
        {video.link && (
          <a
            href={video.link}
            target="_blank"
            rel="sponsored noopener noreferrer"
            className="absolute right-3 bottom-3 rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-black shadow hover:bg-white/90"
          >
            {video.cta}
          </a>
        )}
      </div>
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 font-mono text-[13px] text-muted">
        <span className="tabular-nums">{progress < 1 ? clock(Math.max(0, total * (1 - progress))) : "Done"}</span>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-hover" role="progressbar" aria-label="Ad progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <i className="block h-full rounded-full bg-accent transition-[width] duration-300 ease-linear" style={{ width: `${progress * 100}%` }} />
        </div>
        <span>+{SPOT_REWARD}</span>
      </div>
    </div>
  );
}

/**
 * Which video a rewarded spot plays: one of Wanlly's own MP4s, unless a sold campaign has booked
 * this place (paying advertisers come first) or none is running.
 */
function useSpotVideo(placement: string): HouseVideo | null {
  const video = useHouseVideo();
  const booked = useSponsors(placement, NO_SPONSORS).some((s) => s.campaignId && s.banners?.length);
  return booked ? null : video;
}
const NO_SPONSORS: Sponsor[] = [];

export function RewardedSpot({
  aspect,
  sponsor,
  placement,
  onDone,
  maxHeight,
}: {
  aspect: VideoAspect;
  sponsor: Sponsor;
  placement: Placement;
  onDone: (result: ViewResult) => void;
  maxHeight?: number;
}) {
  const video = useSpotVideo(placement);
  const { progress, media, failed } = useRewardedView(placement, onDone, video);
  if (video && !failed) return <HouseVideoSpot video={video} progress={progress} media={media} maxHeight={maxHeight} />;
  return <NetworkSpot aspect={aspect} sponsor={sponsor} placement={placement} progress={progress} maxHeight={maxHeight} seconds={video ? video.durationMs / 1000 : SPOT_SECONDS} />;
}

/**
 * The ad that plays before a run or for credits: a sold campaign's banner with a countdown under it,
 * else Wanlly's own sponsor video. Never an ad network's banner: networks ban rewarding views of
 * their ordinary banners (see docs/AD-POLICY.md); their official rewarded units are the way in.
 */
export function NetworkSpot({
  aspect,
  sponsor,
  placement,
  progress,
  maxHeight,
  seconds = SPOT_SECONDS,
}: {
  aspect: VideoAspect;
  sponsor: Sponsor;
  placement: string;
  progress: number;
  maxHeight?: number;
  seconds?: number;
}) {
  const [banner, setBanner] = useState(false);
  const left = Math.max(0, Math.ceil(seconds * (1 - progress)));
  return (
    <div className={banner ? "flex flex-col gap-2 p-3" : ""}>
      <DisplaySlot
        placement={placement}
        sizes={["336x280", "300x250", "320x100", "320x50"]}
        label="Sponsored"
        networks={false}
        onBanner={setBanner}
        fallback={
          // Full width: the slot centres its content, which would shrink the video to nothing.
          <div className="w-full">
            <VideoSpot aspect={aspect} sponsor={sponsor} progress={progress} maxHeight={maxHeight} />
          </div>
        }
      />
      {banner && (
        <div className="flex items-center gap-2 font-mono text-xs text-muted">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-hover">
            <i className="block h-full rounded-full bg-accent" style={{ width: `${progress * 100}%` }} />
          </div>
          {progress < 1 ? `${left}s` : "Done"}
        </div>
      )}
    </div>
  );
}

/**
 * A rewarded ad: a sold campaign's banner (or the sponsor's video frame) for the ad's length, then
 * paid like any rewarded view. No ad-network banners here, for the same policy reason as NetworkSpot.
 */
export function RewardedBanner({ placement, sponsor, onDone }: { placement: string; sponsor: Sponsor; onDone: (result: ViewResult) => void }) {
  const video = useSpotVideo(placement);
  const { progress, media, failed } = useRewardedView(placement, onDone, video);
  const left = Math.max(0, Math.ceil((video ? video.durationMs / 1000 : SPOT_SECONDS) * (1 - progress)));
  if (video && !failed)
    return (
      <div className="overflow-hidden rounded-xl border border-line">
        <HouseVideoSpot video={video} progress={progress} media={media} maxHeight={260} />
      </div>
    );
  return (
    <div className="flex flex-col gap-2">
      <DisplaySlot placement={placement} sizes={["336x280", "300x250", "320x100", "320x50"]} label="" networks={false} fallback={<div className="w-full"><VideoSpot aspect="16:9" sponsor={sponsor} progress={progress} /></div>} />
      <div className="flex items-center gap-2 font-mono text-xs text-muted">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-hover">
          <i className="block h-full rounded-full bg-accent" style={{ width: `${progress * 100}%` }} />
        </div>
        {progress < 1 ? `${left}s` : "Adding credits…"}
      </div>
    </div>
  );
}

/** The /dev/ads reference turns this on to print each banner's size under it. */
export const ShowAdSizes = createContext(false);

/** Asks for the largest standard size that fits, the way a network's size mapping does. */
function FittedDisplay({ sizes, sponsor, align = "center" }: { sizes: (keyof typeof DISPLAY_SIZES)[]; sponsor: Sponsor; align?: "center" | "start" }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const size = width ? pickSize(sizes, width) : null;
  const showSize = useContext(ShowAdSizes);
  const networkTest = useNetworkTest();
  const network = useNetwork();
  // A network banner when the network has a size that fits; otherwise the sponsor's banner.
  const netSize = width && network ? (sizes.filter((x) => network.sizes.includes(x as NetworkSize)) as NetworkSize[]).find((x) => DISPLAY_SIZES[x as keyof typeof DISPLAY_SIZES].w <= width) : undefined;
  if (network && netSize && !sponsor.campaignId && !networkTest) {
    return (
      <div ref={ref} className={`flex w-full ${align === "center" ? "justify-center" : "justify-start"}`}>
        <NetworkUnit size={netSize} network={network.name} placement="job_card" />
      </div>
    );
  }
  if (networkTest && size) {
    return (
      <div ref={ref} className={`flex w-full ${align === "center" ? "justify-center" : "justify-start"}`}>
        <NetworkSlot w={DISPLAY_SIZES[size].w} h={DISPLAY_SIZES[size].h} label="Job card" />
      </div>
    );
  }
  return (
    <div ref={ref} className={`flex w-full ${align === "center" ? "justify-center" : "justify-start"}`}>
      {size ? (
        <div className="flex flex-col gap-1">
          <div className="overflow-hidden rounded-xl">
            <DisplayCreative size={size} sponsor={sponsor} />
          </div>
          {showSize && <span className="font-mono text-[10px] text-faint">{size}</span>}
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
  onSpotDone?: (result: ViewResult) => void;
  progress?: number;
}) {
  // Sold campaigns bring a picture, not a video: their card shows the picture, and Watch plays
  // one of Wanlly's own videos so it never looks like the advertiser's.
  const sold = !!sponsor.campaignId;
  // A banner (ad network or a campaign's) took the card: the house sponsor's button goes.
  const [banner, setBanner] = useState(false);
  if (spot === "playing") {
    const video = sold ? SPOT_SPONSOR : sponsor;
    return (
      <div className="animate-rise overflow-hidden rounded-2xl border border-line bg-surface">
        {progress !== undefined ? (
          <NetworkSpot aspect={spotAspect} sponsor={video} placement="job_card" progress={progress} />
        ) : (
          <RewardedSpot aspect={spotAspect} sponsor={video} placement="job_card" onDone={(r) => onSpotDone?.(r)} />
        )}
      </div>
    );
  }

  return (
    <div className="animate-rise overflow-hidden rounded-2xl border border-line bg-surface">
      {sold ? (
        <div className="flex flex-col sm:flex-row">
          <CoverLink sponsor={sponsor} />
          <div className="flex min-w-0 flex-col gap-1 p-3.5">
            <span className={eyebrow}>While you wait · Sponsored</span>
            <div className="flex items-center gap-2">
              <Logo sponsor={sponsor} small />
              <b className="text-[13px] font-semibold">{sponsor.name}</b>
            </div>
            <h3 className="font-display text-[16px] leading-tight font-semibold tracking-[-0.01em]">{sponsor.headline}</h3>
            {sponsor.text && <p className="text-[13px] text-muted">{sponsor.text}</p>}
          </div>
        </div>
      ) : (
        // No sold campaign here: an ad-network banner if one fits, else Wanlly's house sponsor.
        <DisplaySlot
          placement="job_card"
          sizes={["336x280", "300x250", "320x100", "320x50"]}
          label="While you wait · Sponsored"
          className="p-3.5"
          onBanner={setBanner}
          fallback={
            format === "native" ? (
              <div className="flex items-start gap-3 p-3.5">
                <Logo sponsor={sponsor} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className={eyebrow}>While you wait · Sponsored</span>
                  <b className="font-semibold">{sponsor.name}</b>
                  <p className="text-[13px] text-muted">{sponsor.text}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 p-3.5">
                <span className={eyebrow}>While you wait · Sponsored</span>
                <div className="rounded-xl bg-code px-2 py-4">
                  <FittedDisplay sizes={PLACEMENT_SIZES.card} sponsor={sponsor} />
                </div>
              </div>
            )
          }
        />
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3.5 py-2.5">
        {(format === "native" || sold) && !banner && (
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
/** A sponsor card for narrow columns (about 160–200px): logo and name, the line, and the button, stacked. */
export function SponsorStack({ sponsor }: { sponsor: Sponsor }) {
  return (
    <div className="flex w-full min-w-0 animate-rise flex-col gap-2 rounded-xl border border-line bg-surface p-3">
      <div className="flex min-w-0 items-center gap-2">
        <Logo sponsor={sponsor} small />
        <b className="truncate text-[13px] font-semibold">{sponsor.name}</b>
      </div>
      <p className="text-[13px] leading-snug text-muted">{sponsor.headline || sponsor.text}</p>
      <span className={eyebrow}>Sponsored</span>
      <SponsorLink sponsor={sponsor} className="rounded-lg bg-fg px-3 py-1.5 text-center text-xs font-semibold text-bg hover:opacity-90" />
    </div>
  );
}

export function SponsorLine({ sponsor, format, earned }: { sponsor: Sponsor; format: CardFormat; earned: boolean }) {
  const { perAd: SPOT_REWARD } = useReward();
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
    <div className="flex min-w-0 animate-rise items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
      <Logo sponsor={sponsor} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <b className="truncate text-[13px] font-semibold">{sponsor.name}</b>
          <span className={eyebrow}>Sponsored</span>
          {badge}
        </div>
        <p className="truncate text-[13px] text-muted">{sponsor.headline || sponsor.text}</p>
      </div>
      <SponsorLink sponsor={sponsor} className="shrink-0 rounded-lg bg-fg px-3 py-1.5 text-xs font-semibold text-bg hover:opacity-90" />
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
