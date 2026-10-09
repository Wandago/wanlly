"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SPOT_SPONSOR } from "@/lib/catalog";
import { useWorkspace } from "@/lib/workspace-store";
import { RewardedSpot } from "./ads/ad-slot";
import { Composer } from "./composer";
import { Icon } from "./icon";
import { JobView } from "./job-view";
import { TopBar } from "./top-bar";
import { DesignHome } from "./design-home";
import { HomeBanner } from "./ads/home-banner";
import { CanvasProvider, ProjectCanvas, useCanvas } from "./project-canvas";

/** First thing every day: there are no free credits, so one video unlocks the community floor. */
function UnlockCard() {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="animate-rise overflow-hidden rounded-[20px] border border-line bg-surface shadow-soft">
      {playing ? (
        <RewardedSpot aspect="16:9" sponsor={SPOT_SPONSOR} placement="unlock" maxHeight={300} onDone={() => setPlaying(false)} />
      ) : (
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-5">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Icon name="play" size={20} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <b className="font-display text-base font-semibold tracking-[-0.01em]">Watch a short video to get credits</b>
            <p className="text-[13px] text-muted">
              Each 20-second sponsor video adds credits. Spend them on Claude or Gemini, and watch more whenever you need more.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-fg px-4 py-2.5 text-[13px] font-semibold text-bg"
          >
            <Icon name="play" size={15} />
            Watch and earn
          </button>
        </div>
      )}
    </div>
  );
}

export function Workspace() {
  const { jobs, tool, floorUnlocked, synced } = useWorkspace();
  const visible = jobs.filter((j) => j.tool === tool);
  const empty = visible.length === 0;
  const scroller = useRef<HTMLDivElement>(null);

  // Keep the newest job in view when one is added or the tool changes.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible.length, tool]);

  // Follow a streaming reply, unless the person has scrolled up to read.
  const streamed = visible[visible.length - 1]?.text?.length ?? 0;
  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [streamed]);

  if (tool === "design") return <DesignHome />;

  return (
    <CanvasProvider>
      <WithCanvas>
        <main className="flex h-full min-h-0 min-w-0 flex-col">
          <TopBar />
          <div ref={scroller} className={`min-h-0 overflow-auto px-4 ${empty ? "mt-auto flex-[0_1_auto]" : "flex-1"}`}>
            <div className="mx-auto flex w-full max-w-[800px] min-w-0 flex-col gap-[30px] pt-5 pb-3">
              {empty ? (
                <h1 className="pt-2 text-center font-display text-[clamp(24px,3vw,30px)] leading-[1.1] font-semibold tracking-[-0.03em] text-balance">
                  What are we <em className="text-accent not-italic">making</em> today?
                </h1>
              ) : (
                visible.map((job) => <JobView key={job.id} job={job} />)
              )}
            </div>
          </div>
          <div className={`px-4 pt-1.5 pb-[calc(14px+env(safe-area-inset-bottom,0px))] ${empty ? "mb-auto pb-[12vh]" : ""}`}>
            <div className="mx-auto flex w-full max-w-[800px] min-w-0 flex-col gap-3">
              {synced && !floorUnlocked && <UnlockCard />}
              <Composer showSuggestions={empty || tool !== "chat"} />
              {empty && <HomeBanner />}
            </div>
          </div>
        </main>
      </WithCanvas>
    </CanvasProvider>
  );
}

/**
 * Chat on the left and, when a preview is open, the canvas beside it on wide screens (1536px+).
 * On laptops it opens over the chat, so neither is squeezed; on phones it fills the screen.
 */
function WithCanvas({ children }: { children: ReactNode }) {
  const canvas = useCanvas();
  const { jobs, tool } = useWorkspace();
  const shown = !!canvas?.openId && jobs.some((j) => j.id === canvas.openId && j.tool === tool);
  return (
    <div className={`relative grid h-full min-h-0 min-w-0 ${shown ? "2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" : "grid-cols-1"}`}>
      {children}
      {shown && <ProjectCanvas />}
    </div>
  );
}
