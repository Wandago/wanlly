"use client";

import { useEffect, useRef } from "react";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace-store";
import { Composer } from "./composer";
import { EarnDialog } from "./earn-dialog";
import { JobView } from "./job-view";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

function Stage() {
  const { jobs, tool, toast } = useWorkspace();
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
        <div className="mx-auto flex w-full max-w-[800px] flex-col gap-[30px] pt-5 pb-3">
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
        <div className="mx-auto max-w-[800px]">
          <Composer showSuggestions={empty || tool !== "chat"} />
        </div>
      </div>
      {toast && (
        <div
          role="status"
          className="fixed bottom-[calc(20px+env(safe-area-inset-bottom,0px))] left-1/2 z-[60] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-xl bg-fg px-4 py-2.5 text-sm text-bg shadow-soft"
        >
          {toast.text}
        </div>
      )}
    </main>
  );
}

export function Workspace() {
  return (
    <WorkspaceProvider>
      <div className="grid h-full grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)]">
        <Sidebar />
        <Stage />
      </div>
      <EarnDialog />
    </WorkspaceProvider>
  );
}
