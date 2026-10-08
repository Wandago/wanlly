"use client";

import { useEffect, useRef } from "react";
import type { Job } from "@/lib/workspace-store";
import { Icon } from "./icon";

function Meta({ job }: { job: Job }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 font-mono text-xs text-faint">
      <button type="button" aria-label="Copy" className="rounded-lg p-1.5 hover:bg-hover hover:text-fg">
        <Icon name="copy" size={15} />
      </button>
      <button type="button" aria-label="Retry" className="rounded-lg p-1.5 hover:bg-hover hover:text-fg">
        <Icon name="redo" size={15} />
      </button>
      <span className="ml-2">
        {job.modelName} · {job.credits} cr
      </span>
    </div>
  );
}

const pre = "overflow-x-auto rounded-xl border border-line bg-code px-4 py-3.5 font-mono text-[13px] leading-[1.6]";

function ChatResult({ job }: { job: Job }) {
  if (!job.sample) {
    return (
      <>
        <p>
          This is a design build, so replies aren&apos;t connected to a model yet. Once the backend is in,{" "}
          <b>{job.modelName}</b> streams its answer here, in the same spot the working card held.
        </p>
        <Meta job={job} />
      </>
    );
  }
  return (
    <>
      <p>
        Treat ads as something that <b>earns credits</b>, and models as something that <b>spends</b> them. Then every
        user has a balance you can measure in real cents.
      </p>
      <h4 className="mt-1 font-semibold">A setup that holds up</h4>
      <ol className="flex list-decimal flex-col gap-1 pl-5">
        <li>No free credits: one video a day unlocks a small floor that&apos;s the same for everyone.</li>
        <li>Opt-in sponsor videos that top up credits for bigger models.</li>
        <li>A community pool, funded by higher-paying regions, that keeps the floor fair everywhere.</li>
      </ol>
      <pre className={pre}>
        <span className="text-faint">{"// credits are integer half-cents"}</span>
        {"\n"}
        <span className="text-accent">const</span>
        {" cost = usage.input * rate.in + usage.output * rate.out;\nledger.debit(user, Math.ceil(cost / 0.005));"}
      </pre>
      <p>Keep sponsors beside the work, never inside the answer.</p>
      <Meta job={job} />
    </>
  );
}

const STEPS = [
  ["Read the project", "14 files · app/api/chat/route.ts", "0:12"],
  ["Planned the change", "ledger table, debit on stream end, refund on error", "0:31"],
  ["Edited 3 files", "+86 −4 · lib/ledger.ts, db/schema.ts, route.ts", "1:48"],
  ["Tests pass", "vitest · 31 of 31", "2:20"],
] as const;

function CodeResult({ job }: { job: Job }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-muted">
        <Icon name="github" size={15} />
        <b className="font-mono text-xs font-medium text-fg">wandago/wanlly</b> on{" "}
        <b className="font-mono text-xs font-medium text-fg">main</b>
        <span className="inline-flex items-center gap-1.5 text-good">
          <i className="size-[7px] rounded-full bg-current" />
          Connected
        </span>
      </div>
      <ol className="flex flex-col rounded-[14px] border border-line bg-surface">
        {STEPS.map(([title, detail, time]) => (
          <li key={title} className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-3 border-t border-line px-3.5 py-2.5 text-sm first:border-t-0">
            <span className="mt-px grid size-[18px] place-items-center rounded-full bg-fg text-bg">
              <Icon name="check" size={11} className="[stroke-width:3]" />
            </span>
            <div>
              {title}
              <small className="block font-mono text-xs text-muted">{detail}</small>
            </div>
            <time className="font-mono text-xs text-faint">{time}</time>
          </li>
        ))}
      </ol>
      <pre className={pre}>
        <span className="text-faint">lib/ledger.ts</span>
        <span className="text-good">
          {`
+ export async function debit(userId: string, halfCents: number) {
+   const bal = await db.balance(userId);
+   if (bal < halfCents) throw new OutOfCredits(bal);
+   return db.insert(entries).values({ userId, delta: -halfCents });
+ }`}
        </span>
        <span className="text-bad">{"\n- // TODO: track usage"}</span>
      </pre>
      <button type="button" className="inline-flex items-center gap-2 self-start rounded-[10px] bg-fg px-3.5 py-2 text-sm font-semibold text-bg">
        <Icon name="pr" size={15} />
        Open pull request
      </button>
      <Meta job={job} />
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
      return <ChatResult job={job} />;
    case "code":
      return <CodeResult job={job} />;
    case "images":
      return <ImagesResult job={job} />;
    case "design":
      return <DesignResult job={job} />;
  }
}
