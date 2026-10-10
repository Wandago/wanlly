"use client";

import { useRouter } from "next/navigation";
import { useGithubConnect } from "./github-connect";
import { useCallback, useEffect, useRef, useState } from "react";
import { CHEAPEST_MODEL_ID, SPOT_SPONSOR, TOOLS, TOOL_ORDER, getModel } from "@/lib/catalog";
import { isConnected, useReward, useWorkspace } from "@/lib/workspace-store";
import { replyParts } from "@/lib/followups";
import { Icon } from "./icon";
import { RewardedSpot, WatchButton } from "./ads/ad-slot";
import { CreditsButton } from "./credits-button";
import { AttachmentTray, DropOverlay } from "./attachment-tray";
import { useAttachments } from "@/lib/attach";

/** Out-of-credits message, shown inside the composer instead of a pop-up. */
function Gate() {
  const { perAd: SPOT_REWARD, floor: FLOOR_CREDITS } = useReward();
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
              {spots > 1 ? `${spots} ads` : "one ad"}
              {images || modelId === CHEAPEST_MODEL_ID ? "" : `, or switch to ${cheapest.name} for ${cheapest.credits} credit`}.
            </p>
          ) : (
            <p>
              <b>Watch an ad to get credits.</b> Your first one today earns {FLOOR_CREDITS}, then {SPOT_REWARD} for each one after. Sponsors pay for every answer.
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
  const { tool, draft, price, gate, modelId, dispatch, submit, memory, jobs } = useWorkspace();
  const router = useRouter();
  const ta = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const config = TOOLS[tool];
  const connected = isConnected(tool);
  const toast = useCallback((text: string) => dispatch({ type: "toast", text }), [dispatch]);
  const files = useAttachments(toast);
  // Working on an existing repository happens in the Builder, which can open it. Asked here, the
  // repository is asked for (or opened straight away when linked) before any credits are spent.
  const [repoAsk, setRepoAsk] = useState<{ link: string } | null>(null);
  // Back from approving GitHub: the card and the message come back.
  useEffect(() => {
    let waiting: string | null = null;
    try {
      waiting = sessionStorage.getItem(REPO_ASK_KEY);
      sessionStorage.removeItem(REPO_ASK_KEY);
    } catch {}
    if (waiting === null) return;
    const text = waiting;
    queueMicrotask(() => {
      dispatch({ type: "setDraft", draft: text });
      setRepoAsk({ link: "" });
    });
  }, [dispatch]);
  const [starting, setStarting] = useState(false);
  const send = () => {
    if (files.busy || starting) return;
    // Code and the Builder are one place: a code request opens a Builder project that works on
    // it (asking for the repository first when it's about one). Chat and Design never ask.
    if (tool === "code" && !files.items.length && draft.trim()) {
      const repo = repoIntent(draft);
      if (repo) return setRepoAsk({ link: repo.link });
      setStarting(true);
      void startBuild(draft.trim())
        .then((bid) => {
          dispatch({ type: "setDraft", draft: "" });
          router.push(`/build/${bid}`);
        })
        .catch((e) => {
          setStarting(false);
          toast(e instanceof Error ? e.message : "Couldn't start the project. Try again.");
        });
      return;
    }
    submit(files.items);
    files.clear();
  };
  // Claude replies can cost more than the starting price when they run long.
  // Every model scales with the size of the task; images have a flat price.
  const from = tool !== "images";
  // After a reply: the follow-ups it suggested (like Claude's). Before any: memory, then the tool's ideas.
  const last = [...jobs].reverse().find((j) => j.tool === tool && !j.sample);
  const followups = last && last.status === "done" ? replyParts(last.text ?? "").next : [];
  // A different few ideas on each visit, chosen after the page loads so server and browser agree.
  const [seed, setSeed] = useState(0);
  useEffect(() => {
    queueMicrotask(() => setSeed(1 + Math.floor(Math.random() * 1000)));
  }, [tool]);
  const ideas = followups.length ? followups : tool === "chat" && memory?.suggestions.length ? memory.suggestions : pick(config.suggestions, seed);

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  return (
    <div className="flex flex-col gap-2">
      {(showSuggestions || followups.length > 0) && !draft && ideas.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {/* In Chat, suggestions come from what Wanlly remembers about the person, when it has some. */}
          {ideas.map((s) => (
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
      {repoAsk && <RepoAsk initial={repoAsk.link} request={draft} onClose={() => setRepoAsk(null)} onSkip={() => (setRepoAsk(null), submit(files.items), files.clear())} />}
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
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.pdf,.docx,.pptx,.xlsx,.doc,.ppt,.xls,text/*,.md,.csv,.json,.js,.jsx,.ts,.tsx,.py,.html,.css,.sql,.yaml,.yml"
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
          <div className="ml-auto">{connected ? <CreditsButton price={price} from={from} rate={getModel(modelId).credits} /> : <span className="px-2 font-mono text-xs text-faint">Soon</span>}</div>
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

/** Three of the tool's ideas, a different three for each seed (0: the first three). */
function pick(all: string[], seed: number) {
  if (all.length <= 3) return all;
  const start = seed % all.length;
  return [0, 1, 2].map((i) => all[(start + i) % all.length]);
}

/** Where the message waits while the person approves GitHub. */
const REPO_ASK_KEY = "wanlly-repo-ask";
const REPO_LINK = /(?:https?:\/\/)?github\.com\/[\w-]+\/[\w.-]+/i;

/** Starts a Builder project that begins on `request`; returns its id. */
async function startBuild(request: string, repo?: string): Promise<string> {
  const name = repo ? repo.replace(/\/+$/, "").split("/").pop() || "My repository" : request.replace(/\s+/g, " ").slice(0, 48);
  const r = await fetch("/api/build", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.id) throw new Error(b.error ?? "Couldn't start the project. Try again.");
  try {
    if (repo) sessionStorage.setItem(`wanlly-build-repo-${b.id}`, repo.trim());
    if (request.length > 12) sessionStorage.setItem(`wanlly-build-first-${b.id}`, request);
  } catch {}
  return b.id as string;
}

/**
 * "Edit my repo", "update the code in github.com/me/site": a request about a repository the AI
 * hasn't seen. Pasted code (a fenced block) means they shared it, so that goes to the AI.
 */
function repoIntent(text: string): { link: string } | null {
  if (/```/.test(text)) return null;
  const link = text.match(REPO_LINK)?.[0] ?? "";
  const aboutRepo = !!link || /\b(my|our|the|existing|this)\s+(git\s?hub\s+)?(repo|repository|codebase)\b/i.test(text);
  const editing = /\b(edit|change|update|fix|modify|improve|work on|add|remove|refactor|open|continue)\b/i.test(text);
  return aboutRepo && editing ? { link } : null;
}

/** Asks which repository (connecting GitHub, then picking one), and opens it in the Builder with the request carried over. No credits used. */
function RepoAsk({ initial, request, onClose, onSkip }: { initial: string; request: string; onClose: () => void; onSkip: () => void }) {
  const router = useRouter();
  const connect = useGithubConnect();
  const [link, setLink] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gh, setGh] = useState<{ ready: boolean; connected: boolean; repos: { name: string; url: string; private: boolean }[] } | null>(null);
  const [filter, setFilter] = useState("");
  useEffect(() => {
    fetch("/api/github/repos", { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => setGh({ ready: !!b.ready, connected: !!b.connected, repos: b.repos ?? [] }))
      .catch(() => setGh({ ready: false, connected: false, repos: [] }));
  }, []);
  const open = async (target = link) => {
    if (!REPO_LINK.test(target)) return setError("Pick a repository, or paste its link like github.com/you/my-site.");
    setBusy(true);
    setError("");
    try {
      // The request itself, minus the link, runs once the repository is open.
      const bid = await startBuild(request.replace(REPO_LINK, "").trim(), target);
      router.push(`/build/${bid}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the project. Try again.");
      setBusy(false);
    }
  };
  const startConnect = async () => {
    setError("");
    try {
      // Back here afterwards, with this card and the message waiting.
      sessionStorage.setItem(REPO_ASK_KEY, request);
    } catch {}
    try {
      await connect(window.location.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach GitHub.");
    }
  };
  const shown = (gh?.repos ?? []).filter((r) => r.name.toLowerCase().includes(filter.trim().toLowerCase())).slice(0, 8);
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-4 text-sm">
      <div className="flex items-center gap-2">
        <Icon name="github" size={16} />
        <b className="font-semibold">Which repository should we work on?</b>
        <button type="button" onClick={onClose} aria-label="Close" className="ml-auto text-faint hover:text-fg">
          ×
        </button>
      </div>
      <p className="text-[13px] text-muted">Wanlly opens it in the Builder, where the AI reads your real files, changes them and pushes the changes back to GitHub.</p>
      {!gh ? (
        <p className="text-[13px] text-faint">Checking your GitHub…</p>
      ) : !gh.ready ? (
        <button type="button" onClick={startConnect} className="flex items-center justify-center gap-2 self-start rounded-lg bg-fg px-3.5 py-2 text-xs font-semibold text-bg hover:opacity-90">
          <Icon name="github" size={14} /> {gh.connected ? "Allow Wanlly to save to GitHub" : "Connect GitHub"}
        </button>
      ) : (
        <div className="flex flex-col gap-1.5">
          {gh.repos.length > 8 && (
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search your repositories" className="rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs outline-none focus:border-faint" />
          )}
          <div className="flex max-h-[220px] flex-col overflow-y-auto rounded-lg border border-line">
            {shown.length ? (
              shown.map((r) => (
                <button key={r.name} type="button" disabled={busy} onClick={() => void open(r.url)} className="flex items-center gap-2 border-b border-line px-3 py-2 text-left text-[13px] last:border-b-0 hover:bg-hover disabled:opacity-50">
                  <span className="truncate font-mono text-xs">{r.name}</span>
                  {r.private && <span className="ml-auto rounded border border-line px-1.5 text-[10px] text-faint">private</span>}
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-xs text-faint">{gh.repos.length ? "No repository matches." : "No repositories on this GitHub account yet."}</p>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void open()}
          placeholder="…or paste a link: github.com/you/my-site"
          className="min-w-[220px] flex-1 rounded-lg border border-line bg-bg px-2.5 py-2 font-mono text-xs outline-none focus:border-faint"
        />
        <button type="button" disabled={busy || !link.trim()} onClick={() => void open()} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold hover:border-faint disabled:opacity-50">
          {busy ? "Opening…" : "Open in Builder"}
        </button>
      </div>
      <button type="button" onClick={onSkip} className="self-start text-xs text-muted underline-offset-2 hover:text-fg hover:underline">
        Not about a repository? Send my message to the AI instead
      </button>
      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  );
}
