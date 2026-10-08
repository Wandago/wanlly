"use client";

import { useEffect, useRef, useState } from "react";
import { FLOOR_CREDITS, SPOT_SPONSOR } from "@/lib/catalog";
import { useWorkspace } from "@/lib/workspace-store";
import { RewardedSpot } from "./ads/ad-slot";
import { Composer } from "./composer";
import { Icon } from "./icon";
import { JobView } from "./job-view";
import { TopBar } from "./top-bar";

/** First thing every day: there are no free credits, so one video unlocks the community floor. */
function UnlockCard() {
  const { dispatch } = useWorkspace();
  const [playing, setPlaying] = useState(false);
  return (
    <div className="animate-rise overflow-hidden rounded-[20px] border border-line bg-surface shadow-soft">
      {playing ? (
        <RewardedSpot aspect="16:9" sponsor={SPOT_SPONSOR} maxHeight={300} onDone={() => dispatch({ type: "unlockFloor" })} />
      ) : (
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-5">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Icon name="play" size={20} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <b className="font-display text-[19px] font-semibold tracking-[-0.01em]">Start today with one video</b>
            <p className="text-sm text-muted">
              Watch 20 seconds to unlock today&apos;s floor: {FLOOR_CREDITS} credits, about an hour of Haiku. Everyone gets the same floor, wherever they live.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-fg px-4 py-2.5 text-sm font-semibold text-bg"
          >
            <Icon name="play" size={15} />
            Watch and unlock
          </button>
        </div>
      )}
    </div>
  );
}

export function Workspace() {
  const { jobs, tool, floorUnlocked } = useWorkspace();
  const visible = jobs.filter((j) => j.tool === tool);
  const empty = visible.length === 0;
  const scroller = useRef<HTMLDivElement>(null);

  // Keep the newest job in view when one is added or the tool changes.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible.length, tool]);

  return (
    <main className="flex h-full min-h-0 min-w-0 flex-col">
      <TopBar />
      <div ref={scroller} className={`min-h-0 overflow-auto px-4 ${empty ? "mt-auto flex-[0_1_auto]" : "flex-1"}`}>
        <div className="mx-auto flex w-full max-w-[800px] min-w-0 flex-col gap-[30px] pt-5 pb-3">
          {empty ? (
            <h1 className="pt-2 text-center font-display text-[clamp(30px,5vw,42px)] leading-[1.1] font-semibold tracking-[-0.03em] text-balance">
              What are we <em className="text-accent not-italic">making</em> today?
            </h1>
          ) : (
            visible.map((job) => <JobView key={job.id} job={job} />)
          )}
        </div>
      </div>
      <div className={`px-4 pt-1.5 pb-[calc(14px+env(safe-area-inset-bottom,0px))] ${empty ? "mb-auto pb-[12vh]" : ""}`}>
        <div className="mx-auto flex w-full max-w-[800px] min-w-0 flex-col gap-3">
          {!floorUnlocked && <UnlockCard />}
          <Composer showSuggestions={empty || tool !== "chat"} />
        </div>
      </div>
    </main>
  );
}
