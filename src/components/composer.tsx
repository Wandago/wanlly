"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHEAPEST_MODEL_ID, FLOOR_CREDITS, SPOT_REWARD, SPOT_SPONSOR, TOOLS, TOOL_ORDER, getModel } from "@/lib/catalog";
import { isConnected, useWorkspace } from "@/lib/workspace-store";
import { Icon } from "./icon";
import { RewardedSpot, WatchButton } from "./ads/ad-slot";
import { CreditsButton } from "./credits-button";
import { AttachmentTray, DropOverlay } from "./attachment-tray";
import { useAttachments } from "@/lib/attach";

/** Out-of-credits message, shown inside the composer instead of a pop-up. */
function Gate() {
  const { gate, credits, price, tool, modelName, modelId, floorUnlocked, dispatch } = useWorkspace();
  const [phase, setPhase] = useState<"offer" | "playing" | "ready">("offer");

  useEffect(() => {
    if (phase !== "ready") return;
    const t = window.setTimeout(() => dispatch({ type: "closeGate" }), 2500);
    return () => window.clearTimeout(t);
  }, [phase, dispatch]);

  if (!gate) return null;
  const images = tool === "images";
  const gain = floorUnlocked ? SPOT_REWARD : FLOOR_CREDITS;
  const spots = Math.max(1, Math.ceil((price - credits - gain) / SPOT_REWARD) + 1);
  const cheapest = getModel(CHEAPEST_MODEL_ID);

  return (
    <div className="flex flex-col gap-2.5 overflow-hidden rounded-[14px] border border-accent-line bg-accent-soft p-3 text-[13px]">
      {phase === "playing" ? (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <RewardedSpot
            aspect="16:9"
            sponsor={SPOT_SPONSOR}
            placement="gate"
            maxHeight={220}
            onDone={(r) => setPhase(r && r.credits >= price ? "ready" : "offer")}
          />
        </div>
      ) : phase === "ready" ? (
        <p>
          <b>You&apos;re set.</b> Press send to run it.
        </p>
      ) : (
        <>
          {floorUnlocked ? (
            <p>
              <b>{images ? "Images" : modelName}</b> needs {price} credits here and you have {credits}. Watch{" "}
              {spots > 1 ? `${spots} short videos` : "one short video"}
              {images || modelId === CHEAPEST_MODEL_ID ? "" : `, or switch to ${cheapest.name} for ${cheapest.credits} credit`}.
            </p>
          ) : (
            <p>
              <b>Watch a short video to get credits.</b> Your first one today earns {FLOOR_CREDITS}, then {SPOT_REWARD} for each one after. Sponsors pay for every answer.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <WatchButton onClick={() => setPhase("playing")} />
            {floorUnlocked && !images && modelId !== CHEAPEST_MODEL_ID && (
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: "setModel", modelId: CHEAPEST_MODEL_ID });
                  dispatch({ type: "toast", text: `Switched to ${cheapest.name}` });
                }}
                className="rounded-[9px] border border-line bg-surface px-[11px] py-[7px] text-[13px] font-medium hover:border-faint"
              >
                Use {cheapest.name} · {cheapest.credits} cr
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function Composer({ showSuggestions }: { showSuggestions: boolean }) {
  const { tool, draft, price, gate, modelId, dispatch, submit } = useWorkspace();
  const ta = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const config = TOOLS[tool];
  const connected = isConnected(tool);
  const toast = useCallback((text: string) => dispatch({ type: "toast", text }), [dispatch]);
  const files = useAttachments(toast);
  const send = () => {
    if (files.busy) return;
    submit(files.items);
    files.clear();
  };
  // Claude replies can cost more than the starting price when they run long.
  const from = getModel(modelId).provider === "anthropic" && tool !== "images";

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  return (
    <div className="flex flex-col gap-2">
      {showSuggestions && !draft && (
        <div className="flex flex-wrap justify-center gap-2">
          {config.suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                dispatch({ type: "setDraft", draft: s });
                ta.current?.focus();
              }}
              className="max-w-full truncate rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] text-muted hover:border-faint hover:text-fg"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        {...(connected ? files.dropProps : {})}
        className="relative flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-3 pb-2.5 shadow-soft focus-within:border-faint"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {files.dragging && <DropOverlay />}
        {gate && <Gate key={`${gate.needed}-${tool}`} />}
        {!connected && (
          <p className="rounded-xl bg-code px-3 py-2 text-[13px] text-muted">
            <b className="font-medium text-fg">{config.label} is coming soon.</b> What you see here is a sample. Chat and Code work today.
          </p>
        )}
        <AttachmentTray items={files.items} onRemove={files.remove} />
        <label htmlFor="composer-input" className="sr-only">
          Message
        </label>
        <textarea
          id="composer-input"
          ref={ta}
          rows={1}
          value={draft}
          placeholder={config.placeholder}
          onChange={(e) => dispatch({ type: "setDraft", draft: e.target.value })}
          onPaste={connected ? files.onPaste : undefined}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          className="max-h-[200px] min-h-7 w-full resize-none bg-transparent px-1 py-0.5 text-base text-fg md:text-sm outline-none placeholder:text-faint focus-visible:outline-none"
        />
        <div className="flex items-center gap-1.5">
          {connected && (
            <>
              <button
                type="button"
                aria-label="Attach files"
                title="Attach images, PDFs or text files. You can also drop or paste them."
                onClick={() => picker.current?.click()}
                className="grid size-[34px] shrink-0 place-items-center rounded-full text-muted hover:bg-hover hover:text-fg"
              >
                <Icon name="clip" />
              </button>
              <input
                ref={picker}
                type="file"
                multiple
                hidden
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/*,.md,.csv,.json,.js,.jsx,.ts,.tsx,.py,.html,.css,.sql,.yaml,.yml"
                onChange={(e) => {
                  files.add(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
            </>
          )}
          <div role="group" aria-label="Tool" className="flex min-w-0 gap-0.5 rounded-xl bg-hover p-[3px]">
            {TOOL_ORDER.map((id) => {
              const active = id === tool;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  aria-label={TOOLS[id].label}
                  onClick={() => dispatch({ type: "setTool", tool: id })}
                  className={`flex items-center gap-1.5 rounded-[9px] px-2.5 py-[5px] text-[13px] ${active ? "bg-surface font-medium text-fg shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted hover:text-fg"}`}
                >
                  <Icon name={id} size={15} />
                  <span className={active ? "" : "max-md:hidden"}>{TOOLS[id].label}</span>
                </button>
              );
            })}
          </div>
          <div className="ml-auto">{connected ? <CreditsButton price={price} from={from} /> : <span className="px-2 font-mono text-xs text-faint">Soon</span>}</div>
          <button
            type="submit"
            aria-label="Send"
            disabled={(!draft.trim() && !files.items.length) || !connected || files.busy}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-fg text-bg disabled:opacity-25"
          >
            <Icon name="up" />
          </button>
        </div>
      </form>
    </div>
  );
}
