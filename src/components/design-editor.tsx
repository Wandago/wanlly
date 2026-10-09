"use client";

import { useUser } from "@clerk/nextjs";
import * as Menu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TOOLS, getModel, jobCost, type Usage } from "@/lib/catalog";
import { previewDoc, withBody } from "@/lib/design-preview";
import { DRIVE_SCOPE, buildPptx, driveUpload, fileName, saveBlob, type MeasuredSlide } from "@/lib/export";
import { extractTokens, htmlToJsx, tokensToCss, tokensToJson, tokensToTailwind } from "@/lib/design-export";
import { limitReached, useWorkspace } from "@/lib/workspace-store";
import { CreditsButton } from "./credits-button";
import { AttachmentTray, DropOverlay } from "./attachment-tray";
import { forSending, useAttachments } from "@/lib/attach";
import { Icon, type IconName } from "./icon";
import { ModelPicker } from "./top-bar";
import { naturalBreak } from "./ads/interstitial";

/*
 * One design file: ask for a design on the left, see it on the right as it's written, and step
 * through every version. The preview is a sandboxed iframe (see lib/design-preview.ts).
 */

type Kind = "slides" | "design" | "codebase" | "system";
type File = { id: number; name: string; kind: Kind; about: string; instructions: string };
type Version = { id: number; prompt: string; modelId: string; credits: number; createdAt: string };

const KIND: Record<Kind, { label: string; icon: IconName; first: string; placeholder: string }> = {
  slides: { label: "Slides", icon: "slides", first: "Make the deck from the brief", placeholder: "Describe the deck, or a change: “make slide 3 a chart”" },
  design: { label: "Design", icon: "design", first: "Design the screens from the brief", placeholder: "Describe the screens, or a change: “darker header”" },
  codebase: { label: "Design in codebase", icon: "code", first: "Build the screens from the brief", placeholder: "Describe the component, or a change" },
  system: { label: "Design System", icon: "grid", first: "Make the design system from the brief", placeholder: "Describe your brand, or a change: “warmer accent”" },
};

/** The HTML written so far, without the code fence, for a live preview while it streams. */
function partialHtml(text: string) {
  const start = text.search(/<!doctype html|<html[\s>]/i);
  return start >= 0 ? text.slice(start).replace(/```\s*$/, "") : "";
}

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h ago` : new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const seg = (on: boolean) => `flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px] ${on ? "bg-surface font-medium text-fg shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted hover:text-fg"}`;
const ghost = "inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] font-medium hover:border-faint disabled:opacity-50";

export function DesignEditor({ id }: { id: number }) {
  const { modelId, credits, usage, dispatch } = useWorkspace();
  const [file, setFile] = useState<File | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [shown, setShown] = useState<{ id: number; html: string } | null>(null);
  const [error, setError] = useState("");
  const [prompt, setPrompt] = useState("");
  /** The request being worked on: shown as sent, and put back in the box if it fails. */
  const [asked, setAsked] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState("");
  const [note, setNote] = useState("");
  const [view, setView] = useState<"preview" | "code">("preview");
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [full, setFull] = useState<false | "view" | "present">(false);
  const [slide, setSlide] = useState({ index: 0, count: 0 });
  const [copied, setCopied] = useState(false);
  /** On phones the preview and the prompt take turns; side by side from 1024 px. */
  const [pane, setPane] = useState<"preview" | "ask">("preview");
  const [codeAs, setCodeAs] = useState<"html" | "react">("html");
  const [systems, setSystems] = useState<{ id: number; name: string }[]>([]);
  const [systemId, setSystemIdState] = useState<number | null>(() => {
    try {
      return Number(localStorage.getItem(`wanlly-ds-${id}`)) || null;
    } catch {
      return null;
    }
  });
  const setSystemId = (v: number | null) => {
    setSystemIdState(v);
    try {
      if (v) localStorage.setItem(`wanlly-ds-${id}`, String(v));
      else localStorage.removeItem(`wanlly-ds-${id}`);
    } catch {}
  };
  const [editing, setEditing] = useState(false);
  /** The preview confirmed it's editable. */
  const [editReady, setEditReady] = useState(false);
  /** The page never answered the edit request. */
  const [editStuck, setEditStuck] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [working, setWorking] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);
  const waiting = useRef(new Map<string, (data: Record<string, unknown>) => void>());
  const { user } = useUser();
  const toast = useCallback((text: string) => dispatch({ type: "toast", text }), [dispatch]);
  const files = useAttachments(toast);
  const picker = useRef<HTMLInputElement>(null);
  const ctrl = useRef<AbortController | null>(null);

  const model = getModel(modelId);
  const price = jobCost(TOOLS.design, model);

  useEffect(() => {
    let alive = true;
    fetch(`/api/design/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const b = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) return setError(r.status === 404 ? "This design file doesn't exist or isn't yours." : (b.error ?? "Couldn't open this design."));
        setFile(b.file);
        setVersions(b.versions);
        if (b.file.kind !== "system")
          fetch("/api/projects?tool=design", { cache: "no-store" })
            .then((x) => (x.ok ? x.json() : { projects: [] }))
            .then((x: { projects: { id: number; name: string; kind?: string }[] }) => alive && setSystems(x.projects.filter((p) => p.kind === "system").map((p) => ({ id: p.id, name: p.name }))))
            .catch(() => {});
        setShown(b.latest);
        if (!b.latest && (b.file.about || b.file.instructions)) setPrompt(KIND[b.file.kind as Kind].first);
      })
      .catch(() => alive && setError("You're offline."));
    return () => {
      alive = false;
      ctrl.current?.abort();
    };
  }, [id]);

  /** Leaves full screen, and takes the slides out of Present mode too. */
  const leave = useCallback(() => {
    setFull(false);
    frame.current?.contentWindow?.postMessage({ wanlly: "present", on: false }, "*");
  }, []);

  // Slides tell the editor which slide is showing, and when Escape leaves Present mode.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const m = e.data as { wanlly?: string; index?: number; count?: number };
      if (m?.wanlly === "slide") setSlide({ index: m.index ?? 0, count: m.count ?? 0 });
      if (m?.wanlly === "editing") setEditReady(!!(m as { on?: boolean }).on);
      if (m?.wanlly && waiting.current.has(m.wanlly)) {
        waiting.current.get(m.wanlly)!(m as Record<string, unknown>);
        waiting.current.delete(m.wanlly);
      }
      if (m?.wanlly === "exit") leave();
    };
    addEventListener("message", onMessage);
    return () => removeEventListener("message", onMessage);
  }, [leave]);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && leave();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [full, leave]);

  // Live preview while a version is written, refreshed a little at a time so the page doesn't flicker.
  const [liveDoc, setLiveDoc] = useState("");
  useEffect(() => {
    if (!busy) return;
    const t = window.setTimeout(() => setLiveDoc(partialHtml(live)), 1200);
    return () => window.clearTimeout(t);
  }, [live, busy]);

  const html = busy && liveDoc ? liveDoc : (shown?.html ?? "");
  const srcDoc = useMemo(() => (html && file ? previewDoc(html, file.kind) : ""), [html, file]);

  const present = () => {
    setFull("present");
    window.setTimeout(() => {
      frame.current?.contentWindow?.postMessage({ wanlly: "present", on: true, index: 0 }, "*");
      frame.current?.focus();
    }, 60);
  };

  const generate = async () => {
    const text = prompt.trim();
    if ((!text && !files.items.length) || busy || !file || files.busy) return;
    const sending = files.items;
    const limit = limitReached(usage, price);
    if (limit) return dispatch({ type: "toast", text: limit });
    if (price > credits) return dispatch({ type: "setEarnOpen", open: true });
    setBusy(true);
    setAsked(text);
    setPrompt("");
    let made = false;
    setNote("");
    setLive("");
    setLiveDoc("");
    setView("preview");
    setPane("preview");
    const c = new AbortController();
    ctrl.current = c;
    const account = (b: { credits?: number; floorUnlocked?: boolean; usage?: Usage }) =>
      typeof b.credits === "number" && b.usage && dispatch({ type: "account", credits: b.credits, floorUnlocked: !!b.floorUnlocked, usage: b.usage });
    try {
      const r = await fetch(`/api/design/${id}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: text, modelId, jobId: `design-${crypto.randomUUID()}`, baseVersionId: shown?.id ?? null, attachments: forSending(sending), systemId: systems.some((x) => x.id === systemId) ? systemId : null }),
        signal: c.signal,
      });
      if (!r.ok || !r.body) {
        const b = await r.json().catch(() => ({}));
        account(b);
        setNote(b.reason === "credits" ? "Not enough credits. Watch a video to earn more." : b.reason === "day" || b.reason === "week" ? (limitReached(b.usage, Infinity) ?? "You've reached your limit.") : (b.error ?? "Couldn't start that."));
        return;
      }
      const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      let all = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.type === "text") {
            all += ev.text;
            setLive(all);
          } else if (ev.type === "done") {
            account(ev);
            const v = await fetch(`/api/design/${id}/versions/${ev.versionId}`, { cache: "no-store" }).then((x) => x.json());
            setVersions((xs) => [{ id: ev.versionId, prompt: text || `Used ${sending.length} attached file${sending.length > 1 ? "s" : ""}`, modelId, credits: ev.charged, createdAt: ev.createdAt }, ...xs]);
            setShown(v);
            made = true;
            files.clear();
            naturalBreak();
            if (ev.cutShort) setNote("This one hit the length limit, so the end may be missing. Ask for a shorter version or fewer slides.");
          } else if (ev.type === "error") {
            account(ev);
            setNote(ev.message);
          }
        }
      }
    } catch (e) {
      setNote(e instanceof Error && e.name === "AbortError" ? "Stopped. Your credits were refunded." : "Connection lost. If no design arrived, your credits were refunded.");
      fetch("/api/me", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => b && account(b))
        .catch(() => {});
    } finally {
      setBusy(false);
      setLiveDoc("");
      setAsked("");
      // Nothing was made: put the request back so it can be tried again or changed.
      if (!made) setPrompt((p) => p || text);
      ctrl.current = null;
    }
  };

  const openVersion = async (v: Version) => {
    if (busy || v.id === shown?.id) return;
    const r = await fetch(`/api/design/${id}/versions/${v.id}`, { cache: "no-store" }).catch(() => null);
    if (r?.ok) setShown(await r.json());
    else dispatch({ type: "toast", text: "Couldn't open that version" });
  };

  /** Sends the preview a request and waits for its answer (html or pptx). */
  const ask = (type: "serialize" | "pptx", answer: "html" | "pptx") =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const t = window.setTimeout(() => {
        waiting.current.delete(answer);
        reject(new Error("The preview didn't answer. Try again."));
      }, 15_000);
      waiting.current.set(answer, (d) => {
        window.clearTimeout(t);
        resolve(d);
      });
      frame.current?.contentWindow?.postMessage({ wanlly: type }, "*");
    });

  const startEdit = (on: boolean) => {
    setEditing(on);
    setEditReady(false);
    setEditStuck(false);
    setView("preview");
    if (!on) setFrameKey((k) => k + 1); // Cancel: reload the page as it was.
  };

  // Edit mode is (re)sent whenever the preview loads, so it survives switching from Code view
  // and any reload of the frame.
  const sendEdit = useCallback(() => {
    if (editing) frame.current?.contentWindow?.postMessage({ wanlly: "edit", on: true }, "*");
  }, [editing]);
  useEffect(() => {
    const t = window.setTimeout(sendEdit, 50);
    return () => window.clearTimeout(t);
  }, [sendEdit, view, frameKey]);
  // No answer yet (a big page can take a moment to load): ask again every 0.6 s, for up to 15 s.
  useEffect(() => {
    if (!editing || editReady) return;
    let n = 0;
    const iv = window.setInterval(() => {
      if (++n > 25) {
        window.clearInterval(iv);
        setEditStuck(true);
      } else sendEdit();
    }, 600);
    return () => window.clearInterval(iv);
  }, [editing, editReady, sendEdit]);

  const saveEdit = async () => {
    if (!shown) return;
    setWorking("Saving…");
    try {
      const { body } = await ask("serialize", "html");
      const html = withBody(shown.html, String(body ?? ""));
      const r = await fetch(`/api/design/${id}/versions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ html }) });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b.error ?? "Couldn't save");
      setVersions((xs) => [{ id: b.id, prompt: "Edited by hand", modelId: "edit", credits: 0, createdAt: b.createdAt }, ...xs]);
      setShown({ id: b.id, html });
      setEditing(false);
      dispatch({ type: "toast", text: "Saved as a new version" });
    } catch (e) {
      dispatch({ type: "toast", text: (e as Error).message });
    } finally {
      setWorking("");
    }
  };

  const downloadHtml = () => shown && file && saveBlob(new Blob([shown.html], { type: "text/html" }), `${fileName(file.name)}.html`);

  const downloadJsx = () => shown && file && saveBlob(new Blob([htmlToJsx(shown.html, file.name)], { type: "text/plain" }), `${fileName(file.name)}.jsx`);

  /** Design-system tokens in the format a codebase wants. */
  const downloadTokens = (format: "css" | "tailwind" | "json") => {
    if (!shown || !file) return;
    const tokens = extractTokens(shown.html);
    if (!tokens.length) return dispatch({ type: "toast", text: "No colour or size tokens found. Ask for “define the tokens as CSS variables on :root”." });
    const [text, ext, type] =
      format === "css" ? [tokensToCss(tokens), "tokens.css", "text/css"] : format === "tailwind" ? [tokensToTailwind(tokens), "theme.css", "text/css"] : [tokensToJson(tokens), "tokens.json", "application/json"];
    saveBlob(new Blob([text], { type }), `${fileName(file.name)}-${ext}`);
  };

  const printPdf = () => {
    setView("preview");
    window.setTimeout(() => frame.current?.contentWindow?.postMessage({ wanlly: "print" }, "*"), 50);
    dispatch({ type: "toast", text: "In the print window, choose “Save as PDF”" });
  };

  const makePptx = async () => {
    setView("preview");
    const d = await ask("pptx", "pptx");
    if (d.error || !Array.isArray(d.slides) || !d.slides.length) throw new Error("Couldn't read the slides for PowerPoint.");
    return buildPptx(d.slides as MeasuredSlide[], file?.name ?? "Slides");
  };

  const exportPptx = async () => {
    setWorking("Building PowerPoint…");
    try {
      saveBlob(await makePptx(), `${fileName(file?.name ?? "slides")}.pptx`);
    } catch (e) {
      dispatch({ type: "toast", text: (e as Error).message });
    } finally {
      setWorking("");
    }
  };

  /** Google Drive: asks for permission the first time, then uploads. Slides become Google Slides. */
  const saveToDrive = async () => {
    if (!shown || !file) return;
    setWorking("Saving to Google Drive…");
    try {
      const t = await fetch("/api/google/token", { cache: "no-store" }).then((r) => r.json());
      if (!t.token) {
        const google = user?.externalAccounts.find((a) => a.provider.replace("oauth_", "") === "google");
        const back = window.location.href;
        const acct = google
          ? await google.reauthorize({ additionalScopes: [DRIVE_SCOPE], redirectUrl: back })
          : await user?.createExternalAccount({ strategy: "oauth_google", additionalScopes: [DRIVE_SCOPE], redirectUrl: back });
        const url = acct?.verification?.externalVerificationRedirectURL;
        if (!url) throw new Error("Google Drive isn't set up for Wanlly yet.");
        dispatch({ type: "toast", text: "Allow Google Drive, then press Save to Google Drive again" });
        window.location.href = url.toString();
        return;
      }
      const link =
        file.kind === "slides"
          ? await driveUpload(t.token, await makePptx(), file.name, "application/vnd.google-apps.presentation")
          : await driveUpload(t.token, new Blob([shown.html], { type: "text/html" }), `${file.name}.html`);
      window.open(link, "_blank", "noopener");
      dispatch({ type: "toast", text: "Saved to your Google Drive" });
    } catch (e) {
      dispatch({ type: "toast", text: (e as Error).message || "Couldn't save to Google Drive" });
    } finally {
      setWorking("");
    }
  };
  if (error)
    return (
      <main className="grid h-full place-items-center p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <p className="text-[13px] text-muted">{error}</p>
          <Link href="/app" onClick={() => dispatch({ type: "setTool", tool: "design" })} className={ghost}>
            ← Back to Design
          </Link>
        </div>
      </main>
    );
  if (!file) return <main className="grid h-full place-items-center text-[13px] text-muted">Opening…</main>;

  const k = KIND[file.kind];
  const codeText = view === "code" && shown ? (codeAs === "react" && file.kind !== "slides" && file.kind !== "system" ? htmlToJsx(shown.html, file.name) : shown.html) : "";
  const sizeKb = Math.round(live.length / 1024);

  return (
    <main className="relative flex h-full min-h-0 min-w-0 flex-col" {...(editing ? {} : files.dropProps)}>
      {files.dragging && <DropOverlay label="Drop images or files to use in this design" />}
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5 sm:px-4">
        <button type="button" aria-label="Open sidebar" onClick={() => dispatch({ type: "setSidebar", open: true })} className="grid rounded-[10px] p-2 hover:bg-hover md:hidden">
          <Icon name="menu" />
        </button>
        <Link href="/app" onClick={() => dispatch({ type: "setTool", tool: "design" })} className="rounded-lg px-2 py-1 text-[13px] text-muted hover:bg-hover hover:text-fg">
          ← Design
        </Link>
        <Icon name={k.icon} size={16} className="text-faint" />
        <h1 className="min-w-0 truncate text-[15px] font-semibold">{file.name}</h1>
        <span className="rounded-full bg-hover px-2 py-0.5 text-xs text-muted max-sm:hidden">{k.label}</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {file.kind !== "slides" && view === "preview" && (
            <div className="flex gap-0.5 rounded-[10px] bg-hover p-[3px] max-md:hidden" role="group" aria-label="Screen size">
              <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} className={seg(device === "desktop")}>
                Desktop
              </button>
              <button type="button" aria-pressed={device === "phone"} onClick={() => setDevice("phone")} className={seg(device === "phone")}>
                Phone
              </button>
            </div>
          )}
          <div className="flex gap-0.5 rounded-[10px] bg-hover p-[3px]" role="group" aria-label="View">
            <button type="button" aria-pressed={view === "preview"} onClick={() => setView("preview")} className={seg(view === "preview")}>
              Preview
            </button>
            <button type="button" aria-pressed={view === "code"} onClick={() => setView("code")} className={seg(view === "code")} disabled={!shown}>
              Code
            </button>
          </div>
          {file.kind === "slides" ? (
            <button type="button" className={ghost} disabled={!shown || busy} onClick={present}>
              <Icon name="play" size={14} /> Present
            </button>
          ) : (
            <button type="button" className={ghost} disabled={!shown || busy} onClick={() => setFull("view")}>
              Full screen
            </button>
          )}
          <button type="button" className={ghost} disabled={!shown || busy || editing} onClick={() => startEdit(true)}>
            <Icon name="design" size={14} /> <span className="max-sm:hidden">Edit</span>
          </button>
          <Menu.Root>
            <Menu.Trigger className={ghost} disabled={!shown || busy || !!working}>
              <Icon name="up" size={14} /> <span className="max-sm:hidden">{working || "Export"}</span>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content align="end" sideOffset={6} className="z-40 min-w-[220px] rounded-xl border border-line bg-surface p-1 text-fg shadow-soft">
                {[
                  ...(file.kind === "slides" ? [["PowerPoint (.pptx)", "Editable slides", exportPptx] as const] : []),
                  ...(file.kind === "codebase" || file.kind === "design" ? [["React component (.jsx)", "Paste into a React or Next.js app", downloadJsx] as const] : []),
                  ...(file.kind === "system"
                    ? [
                        ["CSS variables", "tokens.css for any project", () => downloadTokens("css")] as const,
                        ["Tailwind theme", "@theme block for Tailwind v4", () => downloadTokens("tailwind")] as const,
                        ["Design tokens (JSON)", "For Figma plugins and Style Dictionary", () => downloadTokens("json")] as const,
                      ]
                    : []),
                  ["PDF", file.kind === "slides" ? "One slide per page" : "Print, then Save as PDF", printPdf] as const,
                  ["Google Drive", file.kind === "slides" ? "Opens as Google Slides" : "Saves the HTML file", saveToDrive] as const,
                  ["HTML file", "The page itself", downloadHtml] as const,
                ].map(([label, hint, run]) => (
                  <Menu.Item key={label} onSelect={() => void run()} className="flex cursor-pointer flex-col rounded-lg px-2.5 py-1.5 outline-none data-[highlighted]:bg-hover">
                    <span className="text-[13px] font-medium">{label}</span>
                    <small className="text-xs text-muted">{hint}</small>
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </header>

      <div className="flex border-b border-line p-1.5 lg:hidden" role="tablist" aria-label="Show">
        {(
          [
            ["preview", "Preview"],
            ["ask", versions.length ? `Ask & versions (${versions.length})` : "Ask"],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={pane === key} onClick={() => setPane(key)} className={`flex-1 rounded-lg py-1.5 text-[13px] ${pane === key ? "bg-hover font-medium" : "text-muted"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Preview */}
        <section className={`relative min-h-[320px] bg-code lg:order-2 ${pane === "preview" ? "" : "max-lg:hidden"}`}>
          {view === "code" && shown ? (
            <div className="absolute inset-0 flex flex-col">
              <div className="flex items-center gap-2 border-b border-line px-3 py-1.5 font-mono text-[11px] text-faint">
                {file.kind !== "slides" && file.kind !== "system" ? (
                  <span className="flex gap-0.5 rounded-md bg-hover p-0.5" role="group" aria-label="Code as">
                    {(["html", "react"] as const).map((k) => (
                      <button key={k} type="button" aria-pressed={codeAs === k} onClick={() => setCodeAs(k)} className={`rounded px-1.5 py-0.5 ${codeAs === k ? "bg-surface text-fg" : ""}`}>
                        {k === "html" ? "HTML" : "React"}
                      </button>
                    ))}
                  </span>
                ) : (
                  "HTML"
                )}
                <span>{Math.round(shown.html.length / 1024)} KB</span>
                <button
                  type="button"
                  className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-hover hover:text-fg"
                  onClick={() =>
                    navigator.clipboard?.writeText(codeText).then(() => {
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1500);
                    })
                  }
                >
                  <Icon name={copied ? "check" : "copy"} size={12} /> {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-[12px] leading-[1.55] whitespace-pre-wrap">{codeText}</pre>
            </div>
          ) : srcDoc ? (
            <div className={full ? "fixed inset-0 z-50 bg-black" : `absolute inset-0 flex justify-center ${device === "phone" && file.kind !== "slides" ? "py-4" : ""}`}>
              <iframe
                ref={frame}
                title={`${file.name} preview`}
                key={frameKey}
                sandbox="allow-scripts allow-modals"
                referrerPolicy="no-referrer"
                srcDoc={srcDoc}
                onLoad={sendEdit}
                className={`h-full bg-white ${device === "phone" && file.kind !== "slides" && !full ? "w-[390px] max-w-full rounded-[22px] border-[6px] border-[#16171b] shadow-soft" : "w-full"}`}
              />
              {full && (
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  {full === "present" && slide.count > 0 && (
                    <span className="rounded-full bg-black/60 px-2.5 py-1 font-mono text-xs text-white">
                      {slide.index + 1} / {slide.count}
                    </span>
                  )}
                  <button type="button" onClick={leave} className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white hover:bg-black/80">
                    Exit · Esc
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="absolute inset-0 grid place-items-center p-6">
              <div className="flex max-w-[360px] flex-col items-center gap-2 text-center">
                <span className="grid size-12 place-items-center rounded-2xl bg-surface text-muted">
                  <Icon name={k.icon} size={20} />
                </span>
                <b className="font-semibold">{busy ? "Starting…" : "Nothing here yet"}</b>
                <p className="text-[13px] text-muted">{busy ? "The preview appears as soon as the model starts writing." : "Describe what you want on the left, and it'll be designed here."}</p>
              </div>
            </div>
          )}
          {editing && (
            <div className="absolute top-3 left-1/2 z-10 flex max-w-[calc(100%-16px)] -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-surface py-1 pr-1 pl-3.5 text-xs whitespace-nowrap shadow-soft">
              <span className="min-w-0 truncate text-muted max-sm:hidden">
                {editReady ? (
                  <>
                    Editing<span className="max-xl:hidden"> · click any text to change it</span>
                  </>
                ) : editStuck ? (
                  "This page didn't respond."
                ) : (
                  "Turning on editing…"
                )}
              </span>
              {editStuck && !editReady && (
                <button
                  type="button"
                  onClick={() => {
                    setEditStuck(false);
                    setFrameKey((k) => k + 1);
                  }}
                  className="rounded-full px-2.5 py-1 font-medium hover:bg-hover"
                >
                  Reload
                </button>
              )}
              <button type="button" onClick={() => startEdit(false)} className="rounded-full px-2.5 py-1 font-medium hover:bg-hover" disabled={!!working}>
                Cancel
              </button>
              <button type="button" onClick={saveEdit} className="rounded-full bg-fg px-3 py-1 font-semibold text-bg disabled:opacity-60" disabled={!!working || !editReady}>
                {working || (
                  <>
                    Save<span className="max-xl:hidden"> as new version</span>
                  </>
                )}
              </button>
            </div>
          )}
          {busy && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted shadow-soft">
              <span className="size-3.5 animate-spin rounded-full border-2 border-accent-line border-t-accent" />
              {model.name} is designing{sizeKb ? ` · ${sizeKb} KB` : ""}
            </div>
          )}
        </section>

        {/* Brief, versions and the prompt */}
        <aside className={`flex min-h-0 flex-col border-line lg:order-1 lg:border-r ${pane === "ask" ? "max-lg:row-span-2" : "max-lg:hidden"}`}>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            {(file.about || file.instructions) && (
              <details className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px]" open={!versions.length}>
                <summary className="cursor-pointer font-medium">Brief</summary>
                {file.about && <p className="mt-1.5 text-muted">{file.about}</p>}
                {file.instructions && <p className="mt-1.5 whitespace-pre-wrap text-muted">{file.instructions}</p>}
                <Link href={`/projects?open=${file.id}`} className="mt-2 inline-block text-xs text-faint underline underline-offset-2 hover:text-fg">
                  Edit brief
                </Link>
              </details>
            )}
            {versions.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium tracking-[0.08em] text-faint uppercase">Versions</span>
                {versions.map((v, i) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => openVersion(v)}
                    aria-current={v.id === shown?.id}
                    className={`flex flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left text-[13px] ${v.id === shown?.id ? "bg-hover" : "hover:bg-hover/60"}`}
                  >
                    <span className="line-clamp-2">{v.prompt}</span>
                    <small className="font-mono text-[11px] text-faint">
                      v{versions.length - i} · {v.modelId === "edit" ? "Hand edit" : getModel(v.modelId).name} · {v.credits} cr · {ago(v.createdAt)}
                    </small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <form
            className="flex flex-col gap-2 border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              generate();
            }}
          >
            {note && <p className="rounded-lg bg-code px-2.5 py-2 text-xs text-muted">{note}</p>}
            {shown && versions[0] && shown.id !== versions[0].id && <p className="text-xs text-faint">Changes start from the version you&apos;re looking at.</p>}
            {busy && asked && (
              <div className="self-end rounded-[14px_14px_4px_14px] bg-hover px-3 py-2 text-[13px] whitespace-pre-wrap" aria-label="Your request">
                {asked}
              </div>
            )}
            <AttachmentTray items={files.items} onRemove={busy ? () => {} : files.remove} small />
            <label htmlFor="design-prompt" className="sr-only">
              Describe the design
            </label>
            <textarea
              id="design-prompt"
              rows={3}
              value={prompt}
              readOnly={busy}
              onChange={(e) => setPrompt(e.target.value)}
              onPaste={files.onPaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  generate();
                }
              }}
              placeholder={busy ? "Working on your request… you can write the next change when it's done." : k.placeholder}
              className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-[13px] outline-none read-only:opacity-60 focus:border-faint"
            />
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                aria-label="Attach images or files"
                title="Attach a logo, photos, a screenshot to copy, or a PDF brief. You can also drop or paste them."
                onClick={() => picker.current?.click()}
                className="grid size-8 place-items-center rounded-full text-muted hover:bg-hover hover:text-fg"
              >
                <Icon name="clip" size={17} />
              </button>
              <input
                ref={picker}
                type="file"
                multiple
                hidden
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.pdf,.docx,.pptx,.xlsx,.doc,.ppt,.xls,text/*,.md,.csv,.json,.html,.css"
                onChange={(e) => {
                  files.add(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
              <ModelPicker />
              {file.kind !== "system" && systems.length > 0 && (
                <select
                  aria-label="Design system"
                  value={systems.some((x) => x.id === systemId) ? String(systemId) : ""}
                  onChange={(e) => setSystemId(Number(e.target.value) || null)}
                  className="max-w-[150px] truncate rounded-lg border border-line bg-surface px-2 py-1 text-xs text-muted outline-none hover:text-fg"
                >
                  <option value="">No design system</option>
                  {systems.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="ml-auto flex items-center gap-1.5">
                <CreditsButton price={price} from rate={model.credits} />
                {editing ? (
                  <span className="text-xs text-faint">Finish editing first</span>
                ) : busy ? (
                  <button type="button" onClick={() => ctrl.current?.abort()} className={ghost}>
                    Stop
                  </button>
                ) : (
                  <button type="submit" disabled={(!prompt.trim() && !files.items.length) || files.busy} className="rounded-lg bg-fg px-3 py-1.5 text-[13px] font-semibold text-bg disabled:opacity-30">
                    {shown ? "Update" : "Design it"}
                  </button>
                )}
              </div>
            </div>
          </form>
        </aside>
      </div>
    </main>
  );
}
