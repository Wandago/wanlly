"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { useEffect, useRef } from "react";
import { IMAGE_MODEL_NAME, MODELS, TOOLS, getModel } from "@/lib/catalog";
import { useWorkspace } from "@/lib/workspace-store";
import { Icon } from "./icon";

export function CreditTag({ credits }: { credits: number }) {
  return <span className="rounded-full bg-hover px-[7px] py-0.5 font-mono text-[11px] font-medium whitespace-nowrap text-muted">{credits} cr</span>;
}

function ModelPicker() {
  const { modelId, tool, dispatch } = useWorkspace();
  const model = getModel(modelId);

  if (tool === "images") {
    return (
      <div className="flex items-center gap-2 px-2.5 py-[7px] text-sm font-semibold">
        {IMAGE_MODEL_NAME} <CreditTag credits={TOOLS.images.flatCredits ?? 0} />
      </div>
    );
  }

  const groups = [...new Set(MODELS.map((m) => m.group))];
  return (
    <Menu.Root>
      <Menu.Trigger className="flex items-center gap-2 rounded-[10px] px-2.5 py-[7px] text-sm font-semibold outline-none hover:bg-hover focus-visible:outline-2 data-[state=open]:bg-hover">
        {model.name} <CreditTag credits={model.credits} />
        <Icon name="down" size={15} className="text-faint" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="start"
          sideOffset={6}
          className="z-30 w-[330px] max-w-[calc(100vw-32px)] rounded-[14px] border border-line bg-surface p-1.5 text-fg shadow-soft"
        >
          <Menu.RadioGroup value={modelId} onValueChange={(v) => dispatch({ type: "setModel", modelId: v })}>
            {groups.map((g) => (
              <div key={g}>
                <Menu.Label className="px-2.5 pt-2.5 pb-1 text-[11px] font-medium tracking-[0.08em] text-faint uppercase">{g}</Menu.Label>
                {MODELS.filter((m) => m.group === g).map((m) => (
                  <Menu.RadioItem
                    key={m.id}
                    value={m.id}
                    className="grid cursor-pointer grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 rounded-[10px] px-2.5 py-2 outline-none data-[highlighted]:bg-hover"
                  >
                    <b className="flex items-center gap-2 font-semibold">
                      {m.name}
                      <Menu.ItemIndicator>
                        <span className="block size-1.5 rounded-full bg-accent" />
                      </Menu.ItemIndicator>
                    </b>
                    <span className="col-start-2 row-span-2 row-start-1 self-center">
                      <CreditTag credits={m.credits} />
                    </span>
                    <small className="col-start-1 text-[13px] text-muted">{m.description}</small>
                  </Menu.RadioItem>
                ))}
              </div>
            ))}
          </Menu.RadioGroup>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

function CreditsPill() {
  const { credits, dispatch } = useWorkspace();
  const ref = useRef<HTMLButtonElement>(null);
  const last = useRef(credits);

  // Bump the pill when credits go up.
  useEffect(() => {
    const el = ref.current;
    if (el && credits > last.current) {
      el.classList.remove("animate-bump");
      void el.offsetWidth;
      el.classList.add("animate-bump");
    }
    last.current = credits;
  }, [credits]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => dispatch({ type: "setEarnOpen", open: true })}
      aria-label={`${credits} ${credits === 1 ? "credit" : "credits"}. Earn more`}
      className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-[11px] py-1.5 font-mono text-[13px] tabular-nums hover:border-faint"
    >
      <Icon name="bolt" size={15} className="text-accent" />
      {credits}
      <span className="max-md:hidden">{credits === 1 ? "credit" : "credits"}</span>
    </button>
  );
}

export function TopBar() {
  const { dispatch } = useWorkspace();
  return (
    <header className="flex min-h-14 items-center gap-2 px-4 py-2.5">
      <button
        type="button"
        aria-label="Open sidebar"
        onClick={() => dispatch({ type: "setSidebar", open: true })}
        className="grid rounded-[10px] p-2 hover:bg-hover md:hidden"
      >
        <Icon name="menu" />
      </button>
      <ModelPicker />
      <div className="flex-1" />
      <CreditsPill />
    </header>
  );
}
