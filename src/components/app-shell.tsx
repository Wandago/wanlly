"use client";

import type { ReactNode } from "react";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace-store";
import { RAIL_SPONSORS } from "@/lib/catalog";
import { AdRail } from "./ads/rail";
import { DisplayCreative } from "./ads/creatives";
import { EarnDialog } from "./earn-dialog";
import { Sidebar } from "./sidebar";

function Toast() {
  const { toast } = useWorkspace();
  if (!toast) return null;
  return (
    <div
      role="status"
      className="fixed bottom-[calc(20px+env(safe-area-inset-bottom,0px))] left-1/2 z-[60] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-xl bg-fg px-4 py-2.5 text-sm text-bg shadow-soft"
    >
      {toast.text}
    </div>
  );
}

/** Phones have no side panels, so a 320×50 banner sits in a rounded tray at the bottom. */
function PhoneBanner() {
  return (
    <div className="flex items-center justify-center border-t border-line bg-side px-4 pt-2 pb-[calc(8px+env(safe-area-inset-bottom,0px))] md:hidden" aria-label="Sponsored">
      <div className="overflow-hidden rounded-xl">
        <DisplayCreative size="320x50" sponsor={RAIL_SPONSORS[0]} />
      </div>
    </div>
  );
}

/**
 * Every signed-in page: sidebar on the left, the page in the middle, and a sponsor panel on the
 * right from 1280px. The panels are part of the layout, so ads never cover or push the work.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <div className="grid h-full grid-cols-1 grid-rows-[minmax(0,1fr)_auto] md:grid-cols-[260px_minmax(0,1fr)] md:grid-rows-1 xl:grid-cols-[260px_minmax(0,1fr)_344px]">
        <Sidebar />
        <div className="min-h-0 min-w-0">{children}</div>
        <AdRail />
        <PhoneBanner />
      </div>
      <EarnDialog />
      <Toast />
    </WorkspaceProvider>
  );
}
