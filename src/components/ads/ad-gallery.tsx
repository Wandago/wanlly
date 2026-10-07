"use client";

import type { ReactNode } from "react";
import { DISPLAY_SIZES, VIDEO_ASPECTS, type VideoAspect } from "@/lib/ads";
import { SPOT_SPONSOR, TOOLS } from "@/lib/catalog";
import { WorkspaceProvider } from "@/lib/workspace-store";
import { Icon } from "../icon";
import { RailAd, SponsorCard, SponsorLine, VideoSpot } from "./ad-slot";
import { DisplayCreative } from "./creatives";

const WIDTHS = [
  { label: "Desktop", px: 800 },
  { label: "Tablet", px: 560 },
  { label: "Phone", px: 358 },
];

function Frame({ label, px, children, height }: { label: string; px: number; children: ReactNode; height?: number }) {
  return (
    <figure className="flex max-w-full flex-col gap-2" style={{ width: px + 2 }}>
      <figcaption className="flex items-baseline gap-2 font-mono text-xs text-faint">
        <span className="font-sans text-[13px] font-medium text-muted">{label}</span>
        {px}px column
      </figcaption>
      <div className="rounded-2xl border border-dashed border-line bg-bg p-0" style={{ height }}>
        {children}
      </div>
    </figure>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-line py-8">
      <header className="flex max-w-[65ch] flex-col gap-1">
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">{title}</h2>
        <p className="text-sm text-muted">{note}</p>
      </header>
      <div className="flex flex-wrap items-start gap-6">{children}</div>
    </section>
  );
}

const atWidths = (render: () => ReactNode) => WIDTHS.map((w) => <Frame key={w.label} label={w.label} px={w.px}>{render()}</Frame>);

function VideoRow({ aspect }: { aspect: VideoAspect }) {
  const a = VIDEO_ASPECTS[aspect];
  return (
    <Section
      title={`Video spot · ${aspect} ${a.label.toLowerCase()}`}
      note={`Plays inside the working card when someone presses Watch. Full width, capped at ${a.maxHeight}px tall; ${aspect === "16:9" ? "on narrow screens it simply scales down." : "the video stays centered and the sides fill with a blur of its colors, so it never stretches."}`}
    >
      {atWidths(() => (
        <SponsorCard sponsor={TOOLS.images.sponsor} format="native" spot="playing" spotAspect={aspect} progress={0.4} />
      ))}
    </Section>
  );
}

function GoogleOverlay({ phone }: { phone: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-[rgb(8_9_12/0.7)] ${phone ? "h-[560px]" : "h-[420px]"}`}>
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className={`flex w-full flex-col overflow-hidden rounded-xl bg-[#202124] text-white ${phone ? "" : "max-w-[560px]"}`}>
          <div className="flex items-center justify-between px-3 py-2 text-xs text-white/70">
            <span>Ad · Reward: 4 credits</span>
            <span className="grid size-6 place-items-center rounded-full bg-white/10">
              <Icon name="x" size={14} />
            </span>
          </div>
          <div className="grid aspect-video place-items-center bg-[linear-gradient(135deg,#3b3f47,#17181b)] text-sm text-white/60">Video from the ad network</div>
          <div className="px-3 py-2.5 text-xs text-white/70">Close after 15s to keep your reward</div>
        </div>
      </div>
    </div>
  );
}

export function AdGallery() {
  const native = TOOLS.chat.sponsor;
  const display = TOOLS.design.sponsor;
  return (
    <WorkspaceProvider>
      <div className="min-h-full bg-bg px-4 py-10 sm:px-8">
        <div className="mx-auto flex max-w-[1800px] flex-col">
          <header className="flex flex-col gap-2 pb-8">
            <span className="text-[11px] font-medium tracking-[0.08em] text-faint uppercase">Wanlly · design reference</span>
            <h1 className="font-display text-[clamp(28px,4vw,40px)] leading-tight font-semibold tracking-[-0.03em]">Ad formats</h1>
            <p className="max-w-[65ch] text-[15px] text-muted">
              Every ad Wanlly can show, drawn by the real components at the three column widths they meet. Display sizes are never
              stretched: each slot asks for the largest standard size that fits and falls back to a smaller one.
            </p>
          </header>

          <Section title="Working card · Native" note="Sponsor sends a logo, a name, a line of text and a link. Reflows at any width. This is the default.">
            {atWidths(() => (
              <SponsorCard sponsor={native} format="native" spot="idle" spotAspect="16:9" />
            ))}
          </Section>

          <Section
            title="Working card · Display rectangle"
            note="Asks for 336×280. When the card is narrower than that (phones), it falls back to 300×250, the most widely sold size."
          >
            {atWidths(() => (
              <SponsorCard sponsor={display} format="display" spot="idle" spotAspect="16:9" />
            ))}
          </Section>

          <VideoRow aspect="16:9" />
          <VideoRow aspect="9:16" />
          <VideoRow aspect="1:1" />

          <Section title="After the result · Native line" note="The card folds into one line once the result is in. Wraps on narrow screens.">
            {atWidths(() => (
              <div className="p-3">
                <SponsorLine sponsor={native} format="native" earned={false} />
              </div>
            ))}
          </Section>

          <Section title="After the result · 320×50 banner" note="Used when a network fills the slot instead of a direct sponsor. Same size at every width, aligned with the result.">
            {atWidths(() => (
              <div className="p-3">
                <SponsorLine sponsor={display} format="display" earned />
              </div>
            ))}
          </Section>

          <Section
            title="Side rail · 300×600 or 160×600"
            note="Code only, and only when the screen is 1440px or wider, where the right side is empty anyway. Falls back to 160×600 in a narrower rail. Hidden on tablets and phones."
          >
            <Frame label="Wide rail" px={300}>
              <RailAd sponsor={TOOLS.code.sponsor} />
            </Frame>
            <Frame label="Narrow rail" px={200}>
              <RailAd sponsor={TOOLS.code.sponsor} />
            </Frame>
            <Frame label="Tablet and phone" px={240} height={120}>
              <div className="grid h-full place-items-center p-4 text-center text-sm text-faint">Not shown</div>
            </Frame>
          </Section>

          <Section
            title="Google rewarded video (backup)"
            note="When a spot comes from Google instead of a direct sponsor, Google plays it in its own full-screen overlay. We can't place it inside our card, so it's only used when no direct spot is available."
          >
            <Frame label="Desktop" px={800}>
              <GoogleOverlay phone={false} />
            </Frame>
            <Frame label="Phone" px={358}>
              <GoogleOverlay phone />
            </Frame>
          </Section>

          <Section
            title="Earn sheet and out-of-credits message"
            note="Spots started outside a job always use the 16:9 shape, capped lower so the composer stays usable."
          >
            <Frame label="Earn sheet" px={440}>
              <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                <VideoSpot aspect="16:9" sponsor={SPOT_SPONSOR} progress={0.6} />
              </div>
            </Frame>
            <Frame label="Composer gate" px={800}>
              <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                <VideoSpot aspect="16:9" sponsor={SPOT_SPONSOR} progress={0.2} maxHeight={220} />
              </div>
            </Frame>
          </Section>

          <Section
            title="Not used"
            note="Wide banners take a full row above or below the work and make the app read as an ad page. We don't request them."
          >
            {(["728x90", "970x250"] as const).map((size) => (
              <figure key={size} className="flex max-w-full flex-col gap-2">
                <figcaption className="font-mono text-xs text-faint">
                  <span className="font-sans text-[13px] font-medium text-muted">{DISPLAY_SIZES[size].name}</span> {size}
                </figcaption>
                <div className="max-w-full overflow-x-auto opacity-50 grayscale">
                  <DisplayCreative size={size} sponsor={display} />
                </div>
              </figure>
            ))}
          </Section>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
