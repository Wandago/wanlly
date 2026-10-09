"use client";

import { useEffect, useState } from "react";
import { DisplaySlot } from "./ads/display-slot";
import { TOOLS } from "@/lib/catalog";
import { isConnected, useWorkspace, type Job } from "@/lib/workspace-store";
import { JobResult } from "./results";
import { SponsorCard, SponsorLine } from "./ads/ad-slot";
import { Tracked } from "./ads/tracked";
import { AttachmentTray } from "./attachment-tray";
import { creativeOf, useSponsors } from "@/lib/ads-context";

/** Real replies: a spinner and timer until the first words arrive, with Stop. */
function Waiting({ job }: { job: Job }) {
  const { stop } = useWorkspace();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const iv = window.setInterval(() => setElapsed(Date.now() - job.startedAt), 250);
    return () => window.clearInterval(iv);
  }, [job.startedAt]);
  const secs = Math.floor(elapsed / 1000);
  return (
    <div className="flex items-center gap-2.5 text-[13px] text-muted" role="status" aria-live="polite">
      <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-accent-line border-t-accent" />
      <span>{job.modelName} is {job.tool === "code" ? "working" : job.tool === "images" ? "drawing" : "thinking"}</span>
      <time className="font-mono text-xs text-faint tabular-nums">
        {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
      </time>
      <button type="button" onClick={() => stop(job.id)} className="ml-auto rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium hover:border-faint">
        Stop
      </button>
    </div>
  );
}

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
export function JobView({ job, index = 0 }: { job: Job; index?: number }) {
  const { dispatch, stop } = useWorkspace();
  const { adFormat, spotAspect } = TOOLS[job.tool];
  // A booked campaign for this slot if there is one, otherwise the tool's house sponsor.
  const options = useSponsors(adFormat === "native" ? "job_card" : "job_line", [TOOLS[job.tool].sponsor]);
  const sponsor = options[(job.id.length + job.prompt.length) % options.length];
  const showCard = job.status === "working" || job.spot === "playing";

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex max-w-[min(560px,85%)] flex-col items-end gap-2 self-end">
        {job.files?.length ? <AttachmentTray items={job.files} small /> : null}
        {job.prompt && <div className="rounded-[18px_18px_6px_18px] bg-hover px-[15px] py-2.5 whitespace-pre-wrap">{job.prompt}</div>}
      </div>
      <div className={`flex min-w-0 flex-col gap-3 ${job.status === "done" && !job.sample ? "animate-rise" : ""}`}>
        {job.status !== "working" ? (
          <JobResult job={job} />
        ) : !isConnected(job.tool) ? (
          <WorkingStatus job={job} />
        ) : job.text ? (
          <>
            <JobResult job={job} />
            <button type="button" onClick={() => stop(job.id)} className="self-start rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium hover:border-faint">
              Stop
            </button>
          </>
        ) : (
          <Waiting job={job} />
        )}
      </div>
      {showCard ? (
        <Tracked key="card" placement="job_card" format={adFormat} creative={creativeOf(sponsor)}>
          <SponsorCard
            sponsor={sponsor}
            format={adFormat}
            spotAspect={spotAspect}
            spot={job.spot}
            onWatch={() => dispatch({ type: "setSpot", id: job.id, spot: "playing" })}
            onSpotDone={(r) => dispatch({ type: "setSpot", id: job.id, spot: r ? "earned" : "idle" })}
          />
        </Tracked>
      ) : index % 2 === 1 && !job.sample ? (
        // After every second reply, a banner sits between it and the next prompt.
        <DisplaySlot
          placement="between_turns"
          sizes={["728x90", "468x60", "320x100", "320x50"]}
          className="border-y border-line py-3"
          fallback={
            <Tracked key="line" placement="job_line" format={adFormat} creative={creativeOf(sponsor)}>
              <SponsorLine sponsor={sponsor} format={adFormat} earned={job.spot === "earned"} />
            </Tracked>
          }
        />
      ) : (
        <Tracked key="line" placement="job_line" format={adFormat} creative={creativeOf(sponsor)}>
          <SponsorLine sponsor={sponsor} format={adFormat} earned={job.spot === "earned"} />
        </Tracked>
      )}
    </div>
  );
}
