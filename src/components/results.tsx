"use client";

import { useEffect, useRef, useState } from "react";
import { ProjectCard } from "./project-canvas";
import { useWorkspace, type Job } from "@/lib/workspace-store";
import { Markdown } from "./markdown";
import { SpinLoader } from "./spin-mark";
import { Icon } from "./icon";

function Meta({ job }: { job: Job }) {
  const { retry } = useWorkspace();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-0.5 font-mono text-xs text-faint">
      {job.text && (
        <button
          type="button"
          aria-label="Copy reply"
          onClick={() =>
            navigator.clipboard?.writeText(job.text ?? "").then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            })
          }
          className="rounded-lg p-1.5 hover:bg-hover hover:text-fg"
        >
          <Icon name={copied ? "check" : "copy"} size={15} />
        </button>
      )}
      {!job.sample && (
        <button type="button" aria-label="Ask again" onClick={() => retry(job)} className="rounded-lg p-1.5 hover:bg-hover hover:text-fg">
          <Icon name="redo" size={15} />
        </button>
      )}
      {job.modelName && (
        <span className="ml-2">
          {job.modelName} · {job.credits} cr
        </span>
      )}
    </div>
  );
}

const LANG_NAME: Record<string, string> = { html: "the HTML", css: "the styles", js: "the JavaScript", javascript: "the JavaScript", jsx: "the React code", tsx: "the React code", ts: "the TypeScript", typescript: "the TypeScript", py: "the Python", python: "the Python", sql: "the SQL", json: "the data" };

/** While a reply streams: what it's writing right now (the code block it's in, or the explanation). */
function StreamingNote({ text }: { text: string }) {
  const fences = text.match(/^(```|~~~)\s*([\w+-]*)/gm) ?? [];
  const inCode = fences.length % 2 === 1;
  const lang = inCode ? (fences[fences.length - 1].replace(/^(```|~~~)\s*/, "").toLowerCase() || "") : "";
  const label = inCode ? `Writing ${LANG_NAME[lang] ?? "the code"}` : text.trim() ? "Writing" : "Starting";
  return (
    <p className="flex items-center gap-2 text-xs text-faint" aria-hidden="true">
      <SpinLoader size={12} label="" className="text-accent" />
      <span key={label} className="wl-phase">
        {label}
        <span className="wl-dots" />
      </span>
    </p>
  );
}

/** A real reply from Chat or Code: streams in, then shows copy, ask again and what it cost. */
function TextResult({ job }: { job: Job }) {
  if (job.status === "error") {
    return (
      <>
        {job.text && <Markdown text={job.text} openable />}
        <p className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] text-muted">{job.error}</p>
        <Meta job={job} />
      </>
    );
  }
  const streaming = job.status === "working";
  return (
    <>
      <div aria-live={streaming ? "polite" : undefined} aria-busy={streaming}>
        <Markdown text={job.text ?? ""} openable />
        {streaming && <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-fg/60" aria-hidden="true" />}
      </div>
      {streaming && <StreamingNote text={job.text ?? ""} />}
      <ProjectCard job={job} />
      {job.stop === "max_tokens" && <p className="text-xs text-faint">The reply hit its length limit. Ask it to continue.</p>}
      {job.stop === "interrupted" && <p className="text-xs text-faint">Stopped before the end.</p>}
      {!streaming && <Meta job={job} />}
    </>
  );
}

const PALETTES = [
  ["#f2b48a", "#e06a3b", "#3b2a22"],
  ["#bfd8d2", "#5e8c7f", "#1e2b28"],
  ["#f4e3b5", "#d99a2b", "#4a3418"],
  ["#d7c9f0", "#7d62c4", "#24193d"],
  ["#f7c9c9", "#d9525e", "#3a1519"],
  ["#c9ddf7", "#3e78c9", "#14233a"],
];

/** Stand-in artwork until an image API is connected (Phase 5). */
function Placeholder({ seed, label }: { seed: number; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const x = ref.current?.getContext("2d");
    if (!x) return;
    const [a, b, c] = PALETTES[seed % PALETTES.length];
    const g = x.createLinearGradient(0, 0, 400, 400);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    x.fillStyle = g;
    x.fillRect(0, 0, 400, 400);
    x.fillStyle = c;
    x.globalAlpha = 0.85;
    x.beginPath();
    x.ellipse(200, 330, 130, 26, 0, 0, 7);
    x.fill();
    x.globalAlpha = 1;
    x.fillStyle = a;
    x.fillRect(150, 170, 100, 150);
    x.beginPath();
    x.ellipse(200, 170, 50, 12, 0, 0, 7);
    x.fill();
    x.strokeStyle = a;
    x.lineWidth = 14;
    x.beginPath();
    x.arc(258, 240, 30, -1.3, 1.3);
    x.stroke();
    x.globalAlpha = 0.18;
    x.fillStyle = "#fff";
    x.beginPath();
    x.moveTo(0, 0);
    x.lineTo(180, 0);
    x.lineTo(400, 260);
    x.lineTo(400, 400);
    x.fill();
  }, [seed]);
  return (
    <div className="relative aspect-square max-w-full overflow-hidden rounded-[14px] bg-hover">
      <canvas ref={ref} width={400} height={400} className="block size-full" />
      <span className="absolute bottom-2.5 left-2.5 rounded-lg bg-[rgb(10_10_14/0.55)] px-2 py-1 font-mono text-xs text-white">{label}</span>
    </div>
  );
}

function ImagesResult({ job }: { job: Job }) {
  if (job.status === "error")
    return (
      <>
        <p className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px] whitespace-pre-wrap text-muted">{job.error}</p>
        <Meta job={job} />
      </>
    );
  if (job.sample || !job.pictures) {
    const base = [...job.id].reduce((n, ch) => n + ch.charCodeAt(0), 0);
    return (
      <>
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
          {["Sunlit", "Moody", "Wide", "Close-up"].map((label, i) => (
            <Placeholder key={label} seed={base + i} label={label} />
          ))}
        </div>
        <Meta job={job} />
      </>
    );
  }
  const name = job.prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "wanlly-image";
  return (
    <>
      <div className={`grid gap-2.5 ${job.pictures.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {job.pictures.map((p, i) => (
          <figure key={p.url} className="group relative overflow-hidden rounded-2xl border border-line bg-code">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={job.prompt || "Generated image"} className="block max-h-[70vh] w-full object-contain" />
            <div className="absolute right-2 bottom-2 flex gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
              <a href={p.original} download={`${name}${i ? `-${i + 1}` : ""}.${p.originalType.split("/")[1] ?? "png"}`} className="flex items-center gap-1 rounded-lg bg-black/65 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-black/80">
                <Icon name="down" size={13} /> Full size
              </a>
              <a href={p.url} download={`${name}${i ? `-${i + 1}` : ""}.webp`} className="rounded-lg bg-black/65 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-black/80">
                WebP
              </a>
            </div>
          </figure>
        ))}
      </div>
      {job.text && <p className="text-[13px] text-muted">{job.text}</p>}
      <Meta job={job} />
    </>
  );
}

function DesignResult({ job }: { job: Job }) {
  return (
    <>
      <div className="grid place-items-center rounded-2xl border border-line bg-code bg-[radial-gradient(var(--line)_1px,transparent_1px)] bg-[length:16px_16px] px-4 py-7">
        <div className="aspect-[9/18] w-[220px] max-w-full rounded-[30px] bg-[#0f1014] p-2.5 shadow-soft">
          <div className="flex h-full flex-col gap-2.5 rounded-[22px] bg-[#fff7f2] px-3.5 py-[18px] text-[#1b1310]">
            <small className="font-mono opacity-60">Day 1</small>
            <h3 className="mt-1.5 font-display text-[21px] leading-[1.1] font-semibold tracking-[-0.02em]">Small steps, every single day.</h3>
            <div className="h-16 rounded-[14px] bg-[#ff5a1f]" />
            <div className="h-[11px] rounded-md bg-[#eadfd8]" />
            <div className="h-[11px] w-3/5 rounded-md bg-[#eadfd8]" />
            <div className="mt-auto grid h-10 place-items-center rounded-xl bg-[#1b1310] text-[13px] font-semibold text-[#fff7f2]">Start my streak</div>
          </div>
        </div>
      </div>
      <Meta job={job} />
    </>
  );
}

export function JobResult({ job }: { job: Job }) {
  switch (job.tool) {
    case "chat":
    case "code":
      return <TextResult job={job} />;
    case "images":
      return <ImagesResult job={job} />;
    case "design":
      return <DesignResult job={job} />;
  }
}
