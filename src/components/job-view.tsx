"use client";

import { useEffect, useState } from "react";
import { TOOLS } from "@/lib/catalog";
import { useWorkspace, type Job } from "@/lib/workspace-store";
import { JobResult } from "./results";
import { SponsorCard, SponsorLine } from "./ads/ad-slot";
import { Tracked } from "./ads/tracked";

function WorkingStatus({ job }: { job: Job }) {
  const tool = TOOLS[job.tool];
  const [elapsed, setElapsed] = useState(0);
  const [grow, setGrow] = useState(false);

  useEffect(() => {
    const iv = window.setInterval(() => setElapsed(Date.now() - job.startedAt), 250);
    const raf = requestAnimationFrame(() => setGrow(true));
    return () => {
      window.clearInterval(iv);
      cancelAnimationFrame(raf);
    };
  }, [job.startedAt]);

  const step = Math.min(tool.steps.length - 1, Math.floor((elapsed / tool.durationMs) * tool.steps.length));
  const secs = Math.floor(elapsed / 1000);

  return (
    <div className="flex flex-col gap-2" role="status" aria-live="polite">
      <div className="flex items-center gap-2.5 text-[13px] text-muted">
        <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-accent-line border-t-accent" />
        <span>{tool.steps[step]}</span>
        <time className="ml-auto font-mono text-xs text-faint tabular-nums">0:{String(secs).padStart(2, "0")}</time>
      </div>
      <div className="h-[3px] overflow-hidden rounded-full bg-hover">
        <i
          className="block h-full rounded-full bg-accent ease-linear"
          style={{ width: grow ? "100%" : "0%", transition: `width ${tool.durationMs}ms linear` }}
        />
      </div>
    </div>
  );
}

/**
 * Every tool runs a job the same way: prompt → working card with a sponsor slot → result →
 * the sponsor folds to one line. A spot that's still playing keeps its card until it ends.
 */
export function JobView({ job }: { job: Job }) {
  const { dispatch } = useWorkspace();
  const { sponsor, adFormat, spotAspect } = TOOLS[job.tool];
  const showCard = job.status === "working" || job.spot === "playing";

  return (
    <div className="flex flex-col gap-3.5">
      <div className="max-w-[min(560px,85%)] self-end rounded-[18px_18px_6px_18px] bg-hover px-[15px] py-2.5">{job.prompt}</div>
      <div className={`flex min-w-0 flex-col gap-3 ${job.status === "done" && !job.sample ? "animate-rise" : ""}`}>
        {job.status === "working" ? <WorkingStatus job={job} /> : <JobResult job={job} />}
      </div>
      {showCard ? (
        <Tracked key="card" placement="job_card" format={adFormat} creative={sponsor.name}>
          <SponsorCard
            sponsor={sponsor}
            format={adFormat}
            spotAspect={spotAspect}
            spot={job.spot}
            onWatch={() => dispatch({ type: "setSpot", id: job.id, spot: "playing" })}
            onSpotDone={(r) => dispatch({ type: "setSpot", id: job.id, spot: r ? "earned" : "idle" })}
          />
        </Tracked>
      ) : (
        <Tracked key="line" placement="job_line" format={adFormat} creative={sponsor.name}>
          <SponsorLine sponsor={sponsor} format={adFormat} earned={job.spot === "earned"} />
        </Tracked>
      )}
    </div>
  );
}
