"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "../icon";

const COUNTRIES = ["Kenya", "Nigeria", "Ghana", "Uganda", "Tanzania", "Rwanda", "South Africa", "Egypt", "India", "Pakistan", "Bangladesh", "Indonesia", "Philippines", "Vietnam", "Brazil", "Mexico", "United Kingdom", "United States", "Other"];
const SOURCES = ["TikTok", "X", "Instagram", "LinkedIn", "WhatsApp", "A friend invited me", "University or community group", "Product Hunt", "Search", "Other"];

function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs>
        <mask id="beta-node" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <rect width="64" height="64" fill="#fff" />
          <circle cx="32" cy="26" r="8.8" fill="#000" />
        </mask>
      </defs>
      <rect width="64" height="64" rx="16" className="fill-fg" />
      <path d="M11 21 L21 44 L32 26 L43 44 L53 21" mask="url(#beta-node)" fill="none" strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" className="stroke-bg" />
      <circle cx="32" cy="26" r="6.2" className="fill-accent" />
    </svg>
  );
}

/** A still of the product: the composer and a working card, drawn with the app's own styles. */
function ProductStill() {
  return (
    <div className="mx-auto w-full max-w-[720px] rounded-[28px] border border-line bg-side p-3 shadow-soft sm:p-5">
      <div className="flex flex-col gap-3 rounded-[20px] bg-bg p-4 sm:p-6">
        <div className="max-w-[85%] self-end rounded-[18px_18px_6px_18px] bg-hover px-4 py-2.5 text-[15px]">Build a booking page for my cousin&apos;s salon in Nairobi</div>
        <div className="flex items-center gap-2.5 text-sm text-muted">
          <span className="size-4 animate-spin rounded-full border-2 border-accent-line border-t-accent" />
          Laying out the page
          <span className="ml-auto font-mono text-xs text-faint">0:14</span>
        </div>
        <div className="h-[3px] overflow-hidden rounded-full bg-hover"><i className="block h-full w-2/3 rounded-full bg-accent" /></div>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex items-start gap-3 p-3.5">
            <span className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-[#2747d8] text-sm font-bold text-white">R</span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[11px] tracking-[0.07em] text-faint uppercase">While you wait · Sponsored</span>
              <b className="font-semibold">Railhouse</b>
              <p className="text-sm text-muted">Put this page online with a free preview link.</p>
            </div>
          </div>
          <div className="flex items-center justify-end border-t border-line px-3.5 py-2.5">
            <span className="flex items-center gap-[7px] rounded-[9px] bg-fg px-3 py-[7px] text-[13px] font-semibold text-bg">
              <Icon name="play" size={15} />Watch 20s <span className="font-mono font-medium text-accent">+4</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-[20px] border border-line bg-surface p-3 shadow-soft">
          <span className="flex-1 text-[15px] text-faint">Describe what to build</span>
          <span className="font-mono text-xs text-faint">Sonnet 5.5 · 6 cr</span>
          <span className="grid size-9 place-items-center rounded-full bg-fg text-bg"><Icon name="up" /></span>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { title: "Apply", text: "Tell us what you want to build. It takes a minute." },
  { title: "Get approved", text: "We open Wanlly in weekly groups. Friends you invite move you up." },
  { title: "Watch, earn, build", text: "Short sponsor videos earn credits. Credits run Haiku, Sonnet, Opus and Fable." },
];

export function BetaPage() {
  const [sent, setSent] = useState<null | { name: string; code: string }>(null);
  const [copied, setCopied] = useState(false);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") || "").trim().split(" ")[0];
    // Design preview: nothing is sent yet. The real form posts to /api/beta in Step 2.
    const code = (name || "friend").toLowerCase().replace(/[^a-z]/g, "").slice(0, 8) + "-" + Math.random().toString(36).slice(2, 6);
    setSent({ name, code });
  }
  const link = sent ? `wanlly.app/beta?ref=${sent.code}` : "";

  const field = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] text-fg outline-none placeholder:text-faint focus:border-fg";

  return (
    <div className="min-h-full bg-bg">
      <header className="sticky top-0 z-10 border-b border-line/60 bg-bg/85 px-4 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center gap-2.5">
          <Mark />
          <b className="font-display text-lg font-semibold tracking-[-0.02em]">wanlly</b>
          <a href="#apply" className="ml-auto rounded-full bg-fg px-4 py-1.5 text-sm font-semibold text-bg">Apply for the beta</a>
        </div>
      </header>

      <main className="px-4">
        <section className="mx-auto flex max-w-[1100px] flex-col items-center gap-6 pt-16 pb-12 text-center sm:pt-24">
          <span className="rounded-full border border-line bg-surface px-3 py-1 text-[13px] text-muted">Private beta · opening in weekly groups</span>
          <h1 className="max-w-[16ch] font-display text-[clamp(40px,7vw,76px)] leading-[0.98] font-semibold tracking-[-0.04em] text-balance">
            Frontier AI, paid for by ads.
          </h1>
          <p className="max-w-[56ch] text-[17px] text-muted text-balance">
            Chat, code, design and make images with Haiku, Sonnet, Opus and Fable. Watch a short video, earn credits, build your idea. No card. No subscription.
          </p>
          <a href="#apply" className="rounded-full bg-fg px-6 py-3 text-[15px] font-semibold text-bg">Apply for the beta</a>
        </section>

        <section className="pb-20"><ProductStill /></section>

        <section className="mx-auto grid max-w-[1100px] gap-8 border-t border-line py-16 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex flex-col gap-2">
              <span className="font-mono text-sm text-accent">{i + 1}</span>
              <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em]">{s.title}</h2>
              <p className="text-muted">{s.text}</p>
            </div>
          ))}
        </section>

        <section className="mx-auto grid max-w-[1100px] gap-8 border-t border-line py-16 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-[clamp(28px,4vw,40px)] leading-tight font-semibold tracking-[-0.03em] text-balance">How it&apos;s paid for, in plain numbers.</h2>
            <p className="max-w-[52ch] text-muted">
              About 70% of what your ads earn goes straight to your AI. The rest keeps the lights on. Sponsors sit beside your work, never inside an answer, and never change what a model says.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["4", "credits per 20-second video"],
              ["70%", "of your ad earnings spent on your AI"],
              ["4", "frontier models, from quick to deep"],
              ["0", "cards, subscriptions or API keys"],
            ].map(([n, l]) => (
              <div key={l} className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
                <span className="font-display text-[32px] leading-none font-semibold tracking-[-0.02em]">{n}</span>
                <span className="text-sm text-muted">{l}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="apply" className="mx-auto flex max-w-[560px] scroll-mt-20 flex-col gap-5 border-t border-line py-16">
          {sent ? (
            <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
              <span className="grid size-10 place-items-center rounded-full bg-good/14 text-good"><Icon name="check" /></span>
              <h2 className="font-display text-[26px] font-semibold tracking-[-0.02em]">You&apos;re in the queue{sent.name ? `, ${sent.name}` : ""}.</h2>
              <p className="text-muted">We approve new people every week and email you when it&apos;s your turn. Each friend who applies with your link moves you up.</p>
              <div className="flex items-center gap-2 rounded-xl border border-line bg-bg p-2 pl-3.5">
                <span className="min-w-0 flex-1 truncate font-mono text-sm">{link}</span>
                <button
                  type="button"
                  onClick={async () => {
                    try { await navigator.clipboard.writeText(`https://${link}`); setCopied(true); } catch { setCopied(false); }
                  }}
                  className="rounded-lg bg-fg px-3 py-1.5 text-[13px] font-semibold text-bg"
                >
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
              <p className="text-xs text-faint">Design preview: this form doesn&apos;t send anything yet.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2 text-center">
                <h2 className="font-display text-[clamp(28px,4vw,40px)] font-semibold tracking-[-0.03em]">Apply for the beta</h2>
                <p className="text-muted">We review every application by hand.</p>
              </div>
              <form onSubmit={submit} className="flex flex-col gap-3.5">
                <label className="flex flex-col gap-1.5 text-sm font-medium" htmlFor="b-name">Name<input id="b-name" name="name" required autoComplete="name" className={field} /></label>
                <label className="flex flex-col gap-1.5 text-sm font-medium" htmlFor="b-email">Email<input id="b-email" name="email" type="email" required autoComplete="email" className={field} /></label>
                <label className="flex flex-col gap-1.5 text-sm font-medium" htmlFor="b-country">Country
                  <select id="b-country" name="country" required defaultValue="" className={field}>
                    <option value="" disabled>Choose your country</option>
                    {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium" htmlFor="b-build">What do you want to build?
                  <textarea id="b-build" name="build" required rows={3} placeholder="A booking app for my cousin's salon, a study planner, a portfolio…" className={`${field} resize-none`} />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium" htmlFor="b-source">How did you hear about Wanlly?
                  <select id="b-source" name="source" defaultValue="" className={field}>
                    <option value="" disabled>Choose one</option>
                    {SOURCES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium" htmlFor="b-ref">Invite code <span className="font-normal text-faint">optional</span>
                  <input id="b-ref" name="ref" className={field} />
                </label>
                <button type="submit" className="mt-2 rounded-full bg-fg px-6 py-3 text-[15px] font-semibold text-bg">Apply</button>
                <p className="text-center text-xs text-faint">By applying you agree to hear from us about the beta. No spam, unsubscribe anytime.</p>
              </form>
            </>
          )}
        </section>
      </main>

      <footer className="border-t border-line px-4 py-8">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-3 text-sm text-muted">
          <Mark size={20} />
          <span>Wanlly</span>
          <span className="ml-auto">Built for people with ideas, everywhere.</span>
        </div>
      </footer>
    </div>
  );
}
