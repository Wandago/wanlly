"use client";

import { useEffect, useState } from "react";
import type { Usage } from "@/lib/catalog";
import { resetLabel } from "@/lib/workspace-store";

function Meter({ label, used, limit, resets }: { label: string; used: number; limit: number; resets: string }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2 text-xs">
        <b className="font-medium">{label}</b>
        <span className="ml-auto text-faint">{resets}</span>
        <span className="w-8 text-right font-mono tabular-nums text-muted">{pct}%</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-hover"
        role="progressbar"
        aria-label={`${label}: ${used} of ${limit} credits used`}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
      >
        <i className={`block h-full rounded-full transition-[width] duration-700 ${pct >= 100 ? "bg-[#c2410c]" : "bg-accent"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Session (6 hours) and weekly usage limits, each on this person's own clock, like a plan's usage panel. Relative reset times refresh each minute. */
export function UsageMeters({ usage, videos = false }: { usage: Usage | null; videos?: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 60_000);
    return () => window.clearInterval(t);
  }, []);
  if (!usage) return <div className="h-[58px]" aria-hidden="true" />;
  return (
    <div className="flex flex-col gap-2.5">
      <Meter label="Current session" used={usage.dayUsed} limit={usage.dayLimit} resets={usage.dayResetsAt ? `Resets ${resetLabel(usage.dayResetsAt, "relative")}` : "Starts with your next request"} />
      <Meter label="This week" used={usage.weekUsed} limit={usage.weekLimit} resets={usage.weekResetsAt ? `Resets ${resetLabel(usage.weekResetsAt, "weekday")}` : "Starts with your next request"} />
      {videos && <Meter label="Videos today" used={usage.videos} limit={usage.videoCap} resets={`${usage.videos} of ${usage.videoCap}`} />}
    </div>
  );
}
