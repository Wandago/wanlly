"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { MODELS, SPOT_SPONSOR, isLive } from "@/lib/catalog";
import { replyParts } from "@/lib/followups";
import { highlight, languageOf } from "@/lib/highlight";
import { buildPreview, type BuildFile } from "@/lib/build-preview";
import { saveBlob } from "@/lib/export";
import { SAY } from "@/lib/messages";
import { zipFiles } from "@/lib/runnable";
import { useLocalSetting } from "@/lib/use-local-setting";
import { accountFrom, useReward, useWorkspace } from "@/lib/workspace-store";
import { Icon } from "../icon";
import { Markdown } from "../markdown";
import { SpinLoader } from "../spin-mark";
import { BuildShip } from "./build-ship";
import { ResizeHandle, useDragWidth } from "../resize-handle";
import { DisplaySlot } from "../ads/display-slot";
import { RewardedBanner } from "../ads/ad-slot";

/*
 * The Builder: files on the left, the live preview or a file's code in the middle, and the
 * conversation on the right. Each request runs as a series of steps (/api/build/[id]/step), one
 * at a time, so every step shows its cost and Stop works between and during steps.
 */

type Step = { id: number; role: "user" | "assistant"; text: string; edits?: { command: string; path: string }[]; modelId?: string | null; credits?: number | null };
type Live = { text: string; edits: { command: string; path: string; ok: boolean }[] };

/** Steps one request may take before asking the person whether to keep going. */
const STEP_LIMIT = 25;
const VERB: Record<string, string> = { view: "Read", create: "Wrote", str_replace: "Edited", insert: "Edited", github: "Pushed to GitHub:" };

export function BuilderView({ id }: { id: number }) {
  const { providers, dispatch, credits } = useWorkspace();
  const reward = useReward();
  // Panel widths, dragged by the handles between them and kept for next time.
  const [filesWidth, setFilesWidth] = useDragWidth("wanlly-build-files-w", 200, 140, 420);
  const [chatWidth, setChatWidth] = useDragWidth("wanlly-build-chat-w", 360, 280, 760);
  const [showFiles, setShowFiles] = useLocalSetting("wanlly-build-files", "on");
  // The linked repository, read when a step is sent (kept in the browser by the GitHub panel).
  const repoRef = useRef("");
  useEffect(() => {
    try {
      repoRef.current = localStorage.getItem(`wanlly-build-repo-${id}`) ?? "";
    } catch {}
    const sync = () => {
      try {
        repoRef.current = localStorage.getItem(`wanlly-build-repo-${id}`) ?? "";
      } catch {}
    };
    window.addEventListener("wanlly-local-setting", sync);
    return () => window.removeEventListener("wanlly-local-setting", sync);
  }, [id]);
  const [name, setName] = useState("");
  const [files, setFiles] = useState<BuildFile[] | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [missing, setMissing] = useState(false);
  const [live, setLive] = useState<Live | null>(null);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<{ text: string; resume?: boolean } | null>(null);
  // Out of credits part-way: an ad (the ad network's, when it has one) pays for the next steps.
  const [needAd, setNeedAd] = useState<"ask" | "watching" | null>(null);
  // Topping up before credits run out (a warning shows when only a few steps' worth are left).
  const [topUp, setTopUp] = useState(false);
  const [draft, setDraft] = useState("");
  const [modelId, setModelId] = useLocalSetting("wanlly-build-model", "gemini-flash");
  const [smart, setSmart] = useLocalSetting("wanlly-build-smart", "on");
  const [pane, setPane] = useState<"chat" | "files" | "preview">("chat");
  // The code is the main view: it follows each file as the AI edits it. The preview is opt-in.
  const [view, setView] = useState<"preview" | "code" | "plan">("code");
  const [phone, setPhone] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const started = useRef(false);

  // The models the Builder can drive: Gemini Flash (free to run) and Claude.
  const claude = useMemo(() => MODELS.filter((m) => (m.provider === "anthropic" || m.provider === "google") && isLive(m, providers)), [providers]);
  const model = claude.find((m) => m.id === modelId) ?? claude.find((m) => m.id === "sonnet") ?? claude[0];

  const load = useCallback(async () => {
    const r = await fetch(`/api/build/${id}`, { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return setMissing(true);
    const b = await r.json();
    setName(b.project.name);
    setFiles(b.files);
    setSteps(b.steps);
    if (b.pending && !abort.current) setNotice((n) => n ?? { text: "The last request stopped part-way.", resume: true });
    return b as { steps: Step[] };
  }, [id]);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  /** Runs one request as steps until the AI is done, it fails, the person stops, or the step limit. */
  const run = useCallback(
    async (message: string) => {
      if (!model || running) return;
      // Just "push" / "commit and push": no AI needed (or credits). It's committed straight away.
      if (message.length < 70 && /\b(commit|push)\b/i.test(message) && !/\b(add|make|change|fix|create|remove|build|update|improve|edit)\b/i.test(message)) {
        setNotice(null);
        if (!repoRef.current) {
          window.dispatchEvent(new CustomEvent("wanlly:github", { detail: {} }));
          setNotice({ text: "Pick or paste the repository in the GitHub panel, then say push again." });
          return;
        }
        setRunning(true);
        try {
          const r = await fetch(`/api/build/${id}/github`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repo: repoRef.current, message: "Update from Wanlly" }) });
          const b = await r.json().catch(() => ({}));
          if (b.connect) {
            window.dispatchEvent(new CustomEvent("wanlly:github", { detail: {} }));
            setNotice({ text: "Connect GitHub in the panel, then say push again." });
          } else if (!r.ok) setNotice({ text: b.error ?? SAY.busy });
          else {
            setNotice({ text: `Committed and pushed to ${String(b.url).replace(/^https:\/\//, "")}` });
            dispatch({ type: "toast", text: "Committed and pushed to GitHub" });
          }
        } catch {
          setNotice({ text: SAY.offline });
        } finally {
          setRunning(false);
        }
        return;
      }
      // A repository link in the message becomes the one this project saves to; the AI commits
      // and pushes with its save_to_github tool.
      const link = message.match(/https?:\/\/github\.com\/[\w-]+\/[\w.-]+/i)?.[0];
      if (link) {
        repoRef.current = link;
        localStorage.setItem(`wanlly-build-repo-${id}`, link);
        window.dispatchEvent(new Event("wanlly-local-setting"));
      }
      setRunning(true);
      setNotice(null);
      setNeedAd(null);
      setErrors([]);
      const ctrl = new AbortController();
      abort.current = ctrl;
      let first = true;
      try {
        for (let i = 0; i < STEP_LIMIT; i++) {
          // Smart building: Opus plans the first step, Sonnet does the rest (other models do every step).
          const stepModel = smart === "on" && !first && (model.id === "opus" || model.id === "fable") && claude.some((m) => m.id === "sonnet") ? "sonnet" : model.id;
          setLive({ text: "", edits: [] });
          const r = await fetch(`/api/build/${id}/step`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message: first ? message : "", modelId: stepModel, jobId: crypto.randomUUID(), repo: repoRef.current }),
            signal: ctrl.signal,
          });
          first = false;
          if (!r.ok || !r.body || !(r.headers.get("content-type") ?? "").includes("ndjson")) {
            const b = await r.json().catch(() => ({}));
            const act = accountFrom(b);
            if (act) dispatch(act);
            if (b.done) break;
            if (b.reason === "credits") {
              setNeedAd("ask");
              break;
            }
            setNotice({ text: b.error ?? SAY.busy });
            break;
          }
          const reader = r.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          let finished = false;
          let failed = false;
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let nl;
            while ((nl = buf.indexOf("\n")) >= 0) {
              const line = buf.slice(0, nl);
              buf = buf.slice(nl + 1);
              if (!line.trim()) continue;
              const ev = JSON.parse(line);
              if (ev.type === "text") setLive((l) => (l ? { ...l, text: l.text + ev.text } : l));
              if (ev.type === "edit") {
                setLive((l) => (l ? { ...l, edits: [...l.edits, { command: ev.command, path: ev.path, ok: ev.ok }] } : l));
                // Follow the AI around: show the file it's working on, fresh from the server.
                if (ev.ok && ev.path && !["view", "delete", "github"].includes(ev.command)) {
                  setOpen(ev.path);
                  setView((v) => (v === "preview" ? v : "code"));
                  void load();
                }
              }
              if (ev.type === "done" || ev.type === "error") {
                const act = accountFrom(ev);
                if (act) dispatch(act);
              }
              if (ev.type === "github") {
                if (ev.ok) dispatch({ type: "toast", text: "Committed and pushed to GitHub" });
                // Not connected, or no repository chosen: the GitHub panel takes it from here.
                else if (ev.need) window.dispatchEvent(new CustomEvent("wanlly:github", { detail: {} }));
              }
              if (ev.type === "done") finished = ev.done;
              if (ev.type === "error") {
                failed = true;
                setNotice({ text: ev.message, resume: true });
              }
            }
          }
          await load();
          setLive(null);
          if (finished || failed) break;
          if (i === STEP_LIMIT - 1) setNotice({ text: `Paused after ${STEP_LIMIT} steps so nothing runs away with your credits.`, resume: true });
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") setNotice({ text: SAY.offline, resume: true });
        else setNotice({ text: "Stopped. Your files are saved as they are.", resume: true });
        await load();
      } finally {
        setLive(null);
        setRunning(false);
        abort.current = null;
      }
    },
    [id, model, running, smart, claude, dispatch, load],
  );

  // A new app asks first whether it's for an existing GitHub repository. Its first request (from
  // the Builder's home page) waits until the person answers, then runs on the files they chose.
  const [pendingFirst, setPendingFirst] = useState<string | null>(null);
  const [repoLink, setRepoLink] = useState("");
  const [importing, setImporting] = useState(false);
  const [startNote, setStartNote] = useState("");
  const [startDone, setStartDone] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [, setSavedRepo] = useLocalSetting(`wanlly-build-repo-${id}`, "");
  useEffect(() => {
    if (started.current || !files) return;
    started.current = true;
    let first: string | null = null;
    let repo: string | null = null;
    try {
      first = sessionStorage.getItem(`wanlly-build-first-${id}`);
      sessionStorage.removeItem(`wanlly-build-first-${id}`);
      repo = sessionStorage.getItem(`wanlly-build-repo-${id}`);
      sessionStorage.removeItem(`wanlly-build-repo-${id}`);
    } catch {}
    queueMicrotask(() => {
      // A request with no repository named just starts building; nobody is asked about GitHub.
      if (first && !repo) setAutoRun(first);
      else if (first) setPendingFirst(first);
      if (repo) {
        setRepoLink(repo);
        setAutoOpen(true);
      }
    });
  }, [files, id]);
  // Opened from "Work on a GitHub repository" on the Builder's home page: open it straight away.
  useEffect(() => {
    if (!autoOpen || !repoLink) return;
    queueMicrotask(() => {
      setAutoOpen(false);
      void openRepoRef.current?.();
    });
  }, [autoOpen, repoLink]);
  const [autoRun, setAutoRun] = useState<string | null>(null);
  useEffect(() => {
    if (!autoRun || !model) return;
    queueMicrotask(() => {
      setAutoRun(null);
      setStartDone(true);
      void run(autoRun);
    });
  }, [autoRun, model, run]);
  const openRepoRef = useRef<(() => Promise<void>) | null>(null);
  const choosing = !!files && !files.length && !steps.length && !live && !startDone;

  const startFresh = () => {
    setStartDone(true);
    if (pendingFirst) void run(pendingFirst);
    setPendingFirst(null);
  };
  const openRepo = async () => {
    if (!repoLink.trim()) return setStartNote("Paste the link to your repository, like github.com/you/my-site.");
    setImporting(true);
    setStartNote("");
    try {
      const r = await fetch(`/api/build/${id}/github/import`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repo: repoLink.trim() }) });
      const b = await r.json().catch(() => ({}));
      if (b.connect) {
        // Not connected yet: the GitHub panel walks them through it, then they press Open again.
        window.dispatchEvent(new CustomEvent("wanlly:github", { detail: { repo: repoLink.trim() } }));
        return setStartNote("Connect GitHub in the panel above, then press Open repository again.");
      }
      if (!r.ok) throw new Error(b.error ?? SAY.busy);
      setSavedRepo(b.repo);
      setStartDone(true);
      await load();
      dispatch({ type: "toast", text: `Opened ${b.files} files${b.skipped ? ` (${b.skipped} too big to open)` : ""}` });
      if (pendingFirst) void run(pendingFirst);
      setPendingFirst(null);
    } catch (e) {
      setStartNote(e instanceof Error ? e.message : SAY.offline);
    } finally {
      setImporting(false);
    }
  };
  openRepoRef.current = openRepo;

  // The preview reports its errors; the Builder can hand them back to fix.
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const m = e.data as { wanllyPreview?: string; message?: string };
      if (m?.wanllyPreview === "error" && m.message) setErrors((xs) => (xs.includes(m.message!) ? xs : [...xs, m.message!].slice(-8)));
      if (m?.wanllyPreview === "link" && m.message) dispatch({ type: "toast", text: m.message });
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [dispatch]);

  const preview = useMemo(() => (files ? buildPreview(files) : ""), [files]);
  const plan = files?.find((f) => f.path.toLowerCase() === "plan.md") ?? null;
  // With no file picked yet, open the plan, else the page, else the first file.
  const current =
    files?.find((f) => f.path === open) ??
    plan ??
    files?.find((f) => /(^|\/)index\.html$/i.test(f.path)) ??
    files?.find((f) => /(^|\/)(page|app|main|index)\.(tsx?|jsx?)$/i.test(f.path)) ??
    files?.[0] ??
    null;
  const shown = view;

  if (missing) return <main className="grid h-full place-items-center p-6 text-center text-muted">{SAY.notFound}</main>;
  if (!files) return <main className="grid h-full place-items-center"><SpinLoader size={56} label="Opening your app" /></main>;

  const send = () => {
    const text = draft.trim();
    if (!text || running) return;
    setDraft("");
    // "pull" / "pull latest from GitHub": no AI needed.
    if (text.length < 70 && /\b(pull|fetch|sync)\b/i.test(text) && !/\b(add|make|change|fix|create|remove|build)\b/i.test(text)) return void pull();
    void run(text);
  };
  /** Replaces the project's files with the linked repository's latest version. */
  const pull = async () => {
    if (!repoRef.current) {
      window.dispatchEvent(new CustomEvent("wanlly:github", { detail: {} }));
      return setNotice({ text: "Pick or paste the repository in the GitHub panel first." });
    }
    if (!window.confirm("Pull the latest version from GitHub? The project's files are replaced by the repository's; anything you haven't pushed is lost.")) return;
    setRunning(true);
    setNotice(null);
    try {
      const r = await fetch(`/api/build/${id}/github/import`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repo: repoRef.current }) });
      const b = await r.json().catch(() => ({}));
      if (b.connect) {
        window.dispatchEvent(new CustomEvent("wanlly:github", { detail: {} }));
        setNotice({ text: "Connect GitHub in the panel, then pull again." });
      } else if (!r.ok) setNotice({ text: b.error ?? SAY.busy });
      else {
        await load();
        setNotice({ text: `Pulled ${b.files} files from GitHub.` });
      }
    } catch {
      setNotice({ text: SAY.offline });
    } finally {
      setRunning(false);
    }
  };
  // Ideas for the next message: the AI's follow-ups from its last reply, then GitHub actions.
  const lastReply = [...steps].reverse().find((x) => x.role === "assistant" && x.text);
  const followups = lastReply ? replyParts(lastReply.text).next : [];
  const lowCredits = !!model && credits <= model.credits * 3;
  const runChecks = async () => {
    setChecking(true);
    setReport(null);
    try {
      const r = await fetch(`/api/build/${id}/check`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId: crypto.randomUUID() }) });
      const b = await r.json().catch(() => ({}));
      const act = accountFrom(b);
      if (act) dispatch(act);
      if (!r.ok) setNotice({ text: b.error ?? SAY.busy });
      else setReport(b.report);
    } catch {
      setNotice({ text: SAY.offline });
    } finally {
      setChecking(false);
    }
  };
  const fixErrors = () => void run(`The preview shows these errors:\n${errors.map((e) => `- ${e}`).join("\n")}\nFind the cause and fix it.`);

  const chat = (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {choosing ? (
          <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 text-sm">
            <b className="font-semibold">Before we start: is this for a GitHub repository?</b>
            <p className="text-[13px] text-muted">Open one of your repositories and the AI works on its code; saving to GitHub then updates it. Or start fresh and save it to GitHub later.</p>
            {pendingFirst && <p className="rounded-lg bg-hover px-3 py-2 text-[13px]">Your request: {pendingFirst}</p>}
            <input
              value={repoLink}
              onChange={(e) => setRepoLink(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void openRepo()}
              placeholder="github.com/you/my-site"
              className="rounded-lg border border-line bg-bg px-2.5 py-2 font-mono text-xs outline-none focus:border-faint"
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={importing} onClick={openRepo} className="flex items-center gap-1.5 rounded-lg bg-fg px-3 py-1.5 text-xs font-semibold text-bg hover:opacity-90 disabled:opacity-50">
                <Icon name="github" size={14} /> {importing ? "Opening…" : "Open repository"}
              </button>
              <button type="button" disabled={importing} onClick={startFresh} className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:border-faint disabled:opacity-50">
                {pendingFirst ? "Start fresh and build" : "Start fresh"}
              </button>
            </div>
            {startNote && <p className="text-xs text-bad">{startNote}</p>}
          </div>
        ) : (
          !steps.length &&
          !live && <p className="text-sm text-muted">Describe what to build or change. The AI works in steps: it reads the files it needs, edits them, and checks the result.</p>
        )}
        <ol className="flex flex-col gap-3">
          {steps.map((s) => (
            <li key={s.id} className={s.role === "user" ? "self-end rounded-2xl bg-hover px-3.5 py-2 text-sm" : "flex flex-col gap-1.5 text-sm"}>
              {s.role === "user" ? (
                <span className="whitespace-pre-wrap">{s.text}</span>
              ) : (
                <>
                  {s.text && <Markdown text={replyParts(s.text).body} />}
                  {!!s.edits?.length && <EditList edits={s.edits} />}
                  {s.credits ? <small className="text-[11px] text-faint">{s.credits} credits · {MODELS.find((m) => m.id === s.modelId)?.name ?? s.modelId}</small> : null}
                </>
              )}
            </li>
          ))}
          {live && (
            <li className="flex flex-col gap-1.5 text-sm">
              {live.text && <Markdown text={replyParts(live.text).body} />}
              {!!live.edits.length && <EditList edits={live.edits} />}
              <BuildPhase live={live} />
            </li>
          )}
          {running && (
            <li className="flex justify-center pt-1">
              <DisplaySlot placement="builder_wait" sizes={["320x100", "320x50"]} label="While you wait · Sponsored" />
            </li>
          )}
        </ol>
      </div>
      {report && (
        <div className="mx-4 mb-2 flex max-h-[45%] flex-col gap-2 overflow-y-auto rounded-xl border border-line p-3 text-[13px]">
          <b className="font-semibold">Check report</b>
          <Markdown text={report} />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={running}
              onClick={() => {
                const text = report;
                setReport(null);
                void run(`I ran the project's checks in a sandbox. Here is the report:\n\n${text}\n\nFix what failed.`);
              }}
              className="rounded-lg bg-fg px-2.5 py-1 text-xs font-semibold text-bg disabled:opacity-50"
            >
              Ask the AI to fix
            </button>
            <button type="button" onClick={() => setReport(null)} className="rounded-lg px-2.5 py-1 text-xs text-muted">
              Dismiss
            </button>
          </div>
        </div>
      )}
      {needAd && (
        <div className="mx-4 mb-2 flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-3 text-[13px]">
          {needAd === "ask" ? (
            <>
              <b className="font-semibold">You&apos;re out of credits for this build</b>
              <span className="text-muted">Watch a short ad to earn {reward.perAd} credits, and the Builder carries on where it stopped.</span>
              <button type="button" onClick={() => setNeedAd("watching")} className="flex items-center justify-center gap-1.5 rounded-lg bg-fg px-3 py-2 text-xs font-semibold text-bg hover:opacity-90">
                <Icon name="play" size={13} /> Watch an ad and continue
              </button>
            </>
          ) : (
            <RewardedBanner
              placement="builder"
              sponsor={SPOT_SPONSOR}
              onDone={(result) => {
                setNeedAd(result ? null : "ask");
                if (result) void run("");
              }}
            />
          )}
        </div>
      )}
      {!running && !needAd && !choosing && (
        <div className="mx-4 mb-1 flex justify-center">
          <DisplaySlot placement="builder_banner" sizes={["320x100", "320x50"]} label="" />
        </div>
      )}
      {lowCredits && !needAd && !running && (
        <div className="mx-4 mb-2 flex flex-col gap-2 rounded-xl border border-accent-line bg-accent-soft p-3 text-[13px]">
          {topUp ? (
            <RewardedBanner placement="builder" sponsor={SPOT_SPONSOR} onDone={() => setTopUp(false)} />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1">
                <b className="font-semibold">{credits <= 0 ? "You're out of credits." : `Only ${credits} credit${credits === 1 ? "" : "s"} left.`}</b> Top up now so your next build doesn&apos;t stop half-way.
              </span>
              <button type="button" onClick={() => setTopUp(true)} className="flex items-center gap-1.5 rounded-lg bg-fg px-3 py-1.5 text-xs font-semibold text-bg hover:opacity-90">
                <Icon name="play" size={12} /> Watch an ad · +{reward.perAd}
              </button>
            </div>
          )}
        </div>
      )}
      {!running && !choosing && files && files.length > 0 && (
        <div className="mx-4 mb-1.5 flex flex-wrap gap-1.5">
          {followups.map((f) => (
            <button key={f} type="button" onClick={() => setDraft(f)} className="max-w-full truncate rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-faint hover:text-fg">
              {f}
            </button>
          ))}
          {repoRef.current ? (
            <>
              <button type="button" onClick={() => void run("push")} className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-faint hover:text-fg">
                <Icon name="github" size={12} /> Push to GitHub
              </button>
              <button type="button" onClick={() => void pull()} className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-faint hover:text-fg">
                <Icon name="github" size={12} /> Pull latest
              </button>
            </>
          ) : (
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("wanlly:github", { detail: {} }))} className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-faint hover:text-fg">
              <Icon name="github" size={12} /> Save to GitHub
            </button>
          )}
        </div>
      )}
      {notice && (
        <div className="mx-4 mb-2 flex flex-wrap items-center gap-2 rounded-xl bg-hover px-3 py-2 text-[13px]">
          <span className="min-w-0 flex-1">{notice.text}</span>
          {notice.resume && (
            <button type="button" onClick={() => void run("")} className="font-medium underline-offset-2 hover:underline">
              Continue
            </button>
          )}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="m-3 flex flex-col gap-2 rounded-2xl border border-line bg-surface p-2.5"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder={steps.length ? "What should change next?" : "What do you want to build?"}
          className="w-full resize-none bg-transparent px-1 text-sm outline-none placeholder:text-faint"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Model" value={model?.id ?? ""} onChange={(e) => setModelId(e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1 text-xs">
            {claude.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {(model?.id === "opus" || model?.id === "fable") && (
            <label className="flex items-center gap-1.5 text-xs text-muted" title="Opus plans the first step; Sonnet does the rest, for a fraction of the cost.">
            <input type="checkbox" checked={smart === "on"} onChange={(e) => setSmart(e.target.checked ? "on" : "off")} />
            Smart building
          </label>
          )}
          {running ? (
            <button type="button" onClick={() => abort.current?.abort()} className="ml-auto rounded-lg border border-line px-3 py-1.5 text-xs font-semibold">
              Stop
            </button>
          ) : (
            <button type="submit" disabled={!draft.trim() || !model} className="ml-auto rounded-lg bg-fg px-3 py-1.5 text-xs font-semibold text-bg disabled:opacity-50">
              Build
            </button>
          )}
        </div>
        {!model && <p className="text-xs text-bad">No Builder model is switched on yet.</p>}
      </form>
    </section>
  );

  const fileList = (
    <nav aria-label="Files" className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2">
      <div className="flex items-center justify-between px-3 pb-1 text-[11px] font-medium tracking-[0.08em] text-faint uppercase">
        Files <span className="font-mono normal-case">{files.length}</span>
      </div>
      {files.length ? (
        <FileTree
          paths={files.map((f) => f.path)}
          active={view === "code" ? (current?.path ?? null) : null}
          onOpen={(path) => {
            setOpen(path);
            setView("code");
            setPane("preview");
          }}
        />
      ) : (
        <p className="px-3 text-xs text-faint">No files yet.</p>
      )}
    </nav>
  );

  const stage = (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-line px-3 py-1.5 text-xs">
        <button
          type="button"
          onClick={() => setShowFiles(showFiles === "on" ? "off" : "on")}
          aria-pressed={showFiles === "on"}
          title={showFiles === "on" ? "Hide the file list" : "Show the file list"}
          className="mr-1 hidden rounded-md px-1.5 py-1 text-muted hover:bg-hover hover:text-fg lg:block"
        >
          <Icon name="list" size={14} />
        </button>
        {(plan ? (["code", "plan"] as const) : (["code"] as const)).map((v) => (
          <button key={v} type="button" onClick={() => setView(v)} className={`rounded-md px-2 py-1 capitalize ${shown === v ? "bg-hover font-medium text-fg" : "text-muted"}`}>
            {v}
          </button>
        ))}
        {view === "code" && current && (
          <span className="ml-2 flex min-w-0 items-center gap-1.5 truncate font-mono text-faint">
            {running && live?.edits.at(-1)?.path === current.path && <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-accent" aria-label="Being edited" />}
            {current.path}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {view === "preview" && preview && (
            <button type="button" onClick={() => setPhone(!phone)} aria-pressed={phone} title="Phone-sized preview" className={`rounded-md px-2 py-1 ${phone ? "bg-hover font-medium text-fg" : "text-muted"}`}>
              Phone
            </button>
          )}
          <button
            type="button"
            onClick={() => setView(view === "preview" ? "code" : "preview")}
            aria-pressed={view === "preview"}
            title="A quick look at the page, where the project has one a browser can run"
            className={`rounded-md border border-line px-2 py-1 ${view === "preview" ? "bg-hover font-medium text-fg" : "text-muted hover:text-fg"}`}
          >
            {view === "preview" ? "Close preview" : "Preview"}
          </button>
        </span>
      </div>
      {errors.length > 0 && view === "preview" && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-bad/5 px-3 py-2 text-[13px]">
          <span className="text-bad">
            The preview shows {errors.length} error{errors.length > 1 ? "s" : ""}: <span className="font-mono text-xs">{errors[0]}</span>
          </span>
          <button type="button" disabled={running} onClick={fixErrors} className="ml-auto rounded-lg bg-fg px-2.5 py-1 text-xs font-semibold text-bg disabled:opacity-50">
            Ask the AI to fix
          </button>
        </div>
      )}
      {/* Sponsors keep Wanlly free: a banner over the code as it changes. */}
      {view !== "preview" && (
        <div className="border-b border-line px-3 py-2">
          <DisplaySlot placement="builder_code" sizes={["728x90", "468x60", "320x100", "320x50"]} label="" />
        </div>
      )}
      <div className="min-h-0 flex-1">
        {shown === "plan" && plan ? (
          <div className="h-full overflow-y-auto px-6 py-5 text-[14px]">
            <div className="mx-auto max-w-[680px]">
              <Markdown text={plan.content} />
            </div>
          </div>
        ) : shown === "preview" ? (
          preview ? (
            <div className={`size-full ${phone ? "overflow-y-auto bg-hover py-4" : ""}`}>
              <iframe
                key={preview.length}
                ref={frame}
                title="Preview"
                srcDoc={preview}
                sandbox="allow-scripts allow-modals allow-forms allow-popups"
                className={`block border-0 bg-white ${phone ? "mx-auto h-[720px] max-h-full w-[375px] max-w-full rounded-2xl shadow-lg" : "size-full"}`}
              />
            </div>
          ) : (
            <div className="grid h-full place-items-center p-6 text-center text-sm text-muted">
              {files.length ? "This project doesn't have a page a browser can run (for example a server app). Download it to run it." : "The preview appears here once there are files."}
            </div>
          )
        ) : current ? (
          <FileEditor key={current.path} id={id} file={current} onSaved={load} />
        ) : (
          <div className="grid h-full place-items-center content-center gap-4 p-6 text-center text-sm text-muted">
            <p>{running ? "The AI is getting started…" : "The code shows here as the AI writes it."}</p>
            <DisplaySlot placement="builder_code" sizes={["336x280", "300x250", "320x100"]} />
          </div>
        )}
      </div>
    </section>
  );

  return (
    <main className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <Link href="/build" aria-label="All apps" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg">
          <Icon name="grid" size={16} />
        </Link>
        <input
          aria-label="App name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => fetch(`/api/build/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) })}
          className="min-w-0 flex-1 truncate bg-transparent font-display text-base font-semibold outline-none"
        />
        {/* On narrow screens the actions sit in their own row that scrolls sideways. */}
        <div className="flex items-center gap-2 whitespace-nowrap max-lg:order-last max-lg:w-full max-lg:overflow-x-auto max-lg:pb-0.5 max-lg:[scrollbar-width:none] [&>*]:shrink-0">
        <BuildShip id={id} files={files} name={name} />
        <button
          type="button"
          disabled={running || checking || !files.length}
          onClick={runChecks}
          title="Runs the project in a sandbox: installs what it can, builds, runs tests, and reports what failed"
          className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:border-faint disabled:opacity-50"
        >
          {checking ? "Checking…" : "Run checks"}
        </button>
        <button
          type="button"
          disabled={!files.length}
          onClick={() => saveBlob(zipFiles(files.map((f) => ({ name: f.path, code: f.content }))), `${(name || "app").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.zip`)}
          className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:border-faint disabled:opacity-50"
        >
          Download
        </button>
        <button
          type="button"
          disabled={running}
          title="Clears the conversation so the next request starts fresh (and costs less). Your files stay."
          onClick={async () => {
            if (!window.confirm("Start a new thread? The conversation is cleared; your files stay as they are.")) return;
            await fetch(`/api/build/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "new-thread" }) });
            await load();
          }}
          className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:border-faint"
        >
          New thread
        </button>
        </div>
      </header>
      {/* Below laptop width the panels take turns (tabs); side by side they'd be too narrow. */}
      <div className="flex border-b border-line lg:hidden">
        {(["chat", "files", "preview"] as const).map((p) => (
          <button key={p} type="button" onClick={() => setPane(p)} className={`flex-1 py-2 text-xs capitalize ${pane === p ? "border-b-2 border-fg font-semibold" : "text-muted"}`}>
            {p === "preview" ? "code" : p}
          </button>
        ))}
      </div>
      <div className="hidden min-h-0 flex-1 lg:flex">
        {/* Neither side panel may take more than its share, so the preview always keeps room. */}
        {showFiles === "on" && (
          <>
            <div style={{ width: `min(${filesWidth}px, 22%)` }} className="flex min-h-0 shrink-0 flex-col">
              {fileList}
            </div>
            <ResizeHandle width={filesWidth} onWidth={setFilesWidth} edge="right" label="Resize the file list" onReset={() => setFilesWidth(200)} />
          </>
        )}
        {stage}
        <ResizeHandle width={chatWidth} onWidth={setChatWidth} edge="left" label="Resize the chat" onReset={() => setChatWidth(360)} />
        <div style={{ width: `min(${chatWidth}px, 42%)` }} className="flex shrink-0 flex-col">
          {chat}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">{pane === "chat" ? chat : pane === "files" ? fileList : stage}</div>
    </main>
  );
}

const BUILD_PHASES = ["Reading the request", "Pondering the approach", "Looking through the files", "Planning the changes", "Writing the code", "Checking the work"];
const NOW_DOING: Record<string, string> = { view: "Reading", create: "Writing", str_replace: "Editing", insert: "Editing", github: "Pushing to GitHub" };

/** What the Builder is doing right now: its latest file action, or a phrase that moves on while it thinks. */
function BuildPhase({ live }: { live: Live }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = window.setInterval(() => setTick((t) => t + 1), 3500);
    return () => window.clearInterval(iv);
  }, []);
  const last = live.edits[live.edits.length - 1];
  const label = last && NOW_DOING[last.command] ? `${NOW_DOING[last.command]} ${last.path || "the files"}` : BUILD_PHASES[Math.min(BUILD_PHASES.length - 1, tick)];
  return (
    <span className="flex items-center gap-2 text-xs text-muted" role="status">
      <SpinLoader size={14} label="" />
      <span key={label} className="wl-phase truncate">
        {label}
        <span className="wl-dots" aria-hidden="true" />
      </span>
    </span>
  );
}

type TreeNode = { name: string; path: string; children: Map<string, TreeNode>; file: boolean };

/** The project's files as folders that open and close; big projects start with folders closed. */
function FileTree({ paths, active, onOpen }: { paths: string[]; active: string | null; onOpen: (path: string) => void }) {
  const root = useMemo(() => {
    const top: TreeNode = { name: "", path: "", children: new Map(), file: false };
    for (const p of [...paths].sort((a, b) => a.localeCompare(b))) {
      let node = top;
      p.split("/").forEach((part, i, all) => {
        const path = all.slice(0, i + 1).join("/");
        if (!node.children.has(part)) node.children.set(part, { name: part, path, children: new Map(), file: i === all.length - 1 });
        node = node.children.get(part)!;
      });
    }
    return top;
  }, [paths]);
  const [openDirs, setOpenDirs] = useState<Set<string>>(() => new Set());
  const allOpen = paths.length <= 30;
  const toggle = (path: string) =>
    setOpenDirs((s) => {
      const next = new Set(s);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  const render = (node: TreeNode, depth: number): React.ReactNode =>
    [...node.children.values()]
      .sort((a, b) => Number(a.file) - Number(b.file) || a.name.localeCompare(b.name))
      .map((n) => {
        const pad = { paddingLeft: 12 + depth * 12 };
        if (n.file)
          return (
            <button key={n.path} type="button" onClick={() => onOpen(n.path)} style={pad} title={n.path} className={`block w-full truncate py-1 pr-3 text-left font-mono text-xs ${active === n.path ? "bg-hover text-fg" : "text-muted hover:text-fg"}`}>
              {n.name}
            </button>
          );
        const isOpen = allOpen ? !openDirs.has(n.path) : openDirs.has(n.path) || (!!active && active.startsWith(`${n.path}/`));
        return (
          <div key={n.path}>
            <button type="button" onClick={() => toggle(n.path)} style={pad} className="flex w-full items-center gap-1 truncate py-1 pr-3 text-left font-mono text-xs text-muted hover:text-fg">
              <span className={`inline-block transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
              {n.name}/
            </button>
            {isOpen && render(n, depth + 1)}
          </div>
        );
      });
  return <div className="flex flex-col">{render(root, 0)}</div>;
}

function EditList({ edits }: { edits: { command: string; path: string; ok?: boolean }[] }) {
  return (
    <ul className="flex flex-col gap-0.5 rounded-lg border border-line px-2.5 py-1.5 font-mono text-[11px] text-muted">
      {edits.map((e, i) => (
        <li key={i} className={e.ok === false ? "text-bad" : ""}>
          {VERB[e.command] ?? e.command} {e.path || "/"}
          {e.ok === false ? " · didn't apply" : ""}
        </li>
      ))}
    </ul>
  );
}

/**
 * The code, coloured like an editor: the coloured copy sits behind a see-through text box that
 * does the typing, and both scroll together. Line numbers run down the left.
 */
function CodeArea({ path, value, onChange }: { path: string; value: string; onChange: (v: string) => void }) {
  const shown = useDeferredValue(value);
  const pieces = useMemo(() => highlight(shown, languageOf(path)), [shown, path]);
  const lines = useMemo(() => shown.split("\n").length, [shown]);
  const back = useRef<HTMLPreElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const pad = `calc(${String(lines).length}ch + 28px)`;
  const text = "m-0 whitespace-pre p-3 font-mono text-[12px] leading-[1.65] [tab-size:2]";
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-code">
      <div ref={gutter} aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden border-r border-line py-3 pr-2 pl-3 text-right font-mono text-[12px] leading-[1.65] text-faint select-none" style={{ width: pad }}>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <pre ref={back} aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden text-fg ${text}`} style={{ paddingLeft: pad }}>
        {pieces.map((p, i) => (p.kind ? <span key={i} className={`tk-${p.kind}`}>{p.text}</span> : p.text))}
        {"\n"}
      </pre>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          const t = e.currentTarget;
          if (back.current) {
            back.current.scrollTop = t.scrollTop;
            back.current.scrollLeft = t.scrollLeft;
          }
          if (gutter.current) gutter.current.scrollTop = t.scrollTop;
        }}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="off"
        aria-label={`Code of ${path}`}
        className={`absolute inset-0 resize-none overflow-auto bg-transparent text-transparent caret-fg outline-none selection:bg-accent/25 ${text}`}
        style={{ paddingLeft: pad }}
      />
    </div>
  );
}

/** A file's code, editable by hand. */
function FileEditor({ id, file, onSaved }: { id: number; file: BuildFile; onSaved: () => void }) {
  const [text, setText] = useState(file.content);
  const [state, setState] = useState("");
  const dirty = text !== file.content;
  return (
    <div className="flex h-full flex-col">
      <CodeArea path={file.path} value={text} onChange={setText} />
      <div className="flex items-center gap-2 border-t border-line px-3 py-1.5 text-xs">
        <span className="text-faint">{state}</span>
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm(`Delete ${file.path}?`)) return;
            await fetch(`/api/build/${id}/files?path=${encodeURIComponent(file.path)}`, { method: "DELETE" });
            onSaved();
          }}
          className="ml-auto rounded-md px-2 py-1 text-muted hover:text-bad"
        >
          Delete
        </button>
        <button
          type="button"
          disabled={!dirty}
          onClick={async () => {
            setState("Saving…");
            const r = await fetch(`/api/build/${id}/files`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: file.path, content: text }) }).catch(() => null);
            setState(r?.ok ? "Saved" : SAY.offline);
            if (r?.ok) onSaved();
          }}
          className="rounded-md bg-fg px-2.5 py-1 font-semibold text-bg disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  );
}
