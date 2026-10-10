"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocalSetting } from "@/lib/use-local-setting";

/**
 * A width the person can drag, remembered in this browser. `edge` says which side of the panel
 * the handle sits on: "left" grows the panel as the handle moves left (a panel on the right).
 */
export function useDragWidth(key: string, fallback: number, min: number, max: number) {
  const [saved, save] = useLocalSetting(key, String(fallback));
  const width = Math.min(max, Math.max(min, Number(saved) || fallback));
  return [width, (w: number) => save(String(Math.round(Math.min(max, Math.max(min, w)))))] as const;
}

export function ResizeHandle({ width, onWidth, edge, label, onReset }: { width: number; onWidth: (w: number) => void; edge: "left" | "right"; label: string; onReset?: () => void }) {
  const [drag, setDrag] = useState<{ x: number; w: number } | null>(null);
  const move = useCallback(
    (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      onWidth(edge === "left" ? drag.w - dx : drag.w + dx);
    },
    [drag, edge, onWidth],
  );
  useEffect(() => {
    if (!drag) return;
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, move]);
  return (
    <>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        aria-valuenow={width}
        tabIndex={0}
        title={`Drag to resize${onReset ? " · double-click to reset" : ""}`}
        onPointerDown={(e) => {
          e.preventDefault();
          setDrag({ x: e.clientX, w: width });
        }}
        onDoubleClick={onReset}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") onWidth(width + (edge === "left" ? 24 : -24));
          if (e.key === "ArrowRight") onWidth(width + (edge === "left" ? -24 : 24));
        }}
        className="group relative z-10 w-1.5 shrink-0 cursor-col-resize touch-none outline-none"
      >
        <span className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors ${drag ? "bg-accent" : "bg-line group-hover:bg-faint group-focus-visible:bg-accent"}`} />
      </div>
      {/* While dragging, a cover keeps the preview frame from swallowing the pointer. */}
      {drag && <div className="fixed inset-0 z-50 cursor-col-resize" />}
    </>
  );
}
