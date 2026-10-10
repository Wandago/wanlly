"use client";

import { useState, type FormEvent } from "react";
import { readFirstTouch } from "@/lib/first-touch";
import { Icon } from "../icon";
import { SpinLoader } from "../spin-mark";
import { SAY } from "@/lib/messages";

const COUNTRIES = ["Kenya", "Nigeria", "Ghana", "Uganda", "Tanzania", "Rwanda", "South Africa", "Egypt", "India", "Pakistan", "Bangladesh", "Indonesia", "Philippines", "Vietnam", "Brazil", "Mexico", "United Kingdom", "United States", "Other"];
const SOURCES = ["TikTok", "X", "Instagram", "LinkedIn", "WhatsApp", "A friend invited me", "University or community group", "Product Hunt", "Search", "Other"];

/** A still of the product: the composer and a working card, drawn with the app's own styles. */
function ProductStill() {
  return (
    <div className="mx-auto w-full max-w-[720px] rounded-[28px] border border-line bg-side p-3 shadow-soft sm:p-5">
      <div className="flex flex-col gap-3 rounded-[20px] bg-bg p-4 sm:p-6">
        <div className="max-w-[85%] self-end rounded-[18px_18px_6px_18px] bg-hover px-4 py-2.5 text-[15px]">Build a booking page for my cousin&apos;s salon in Nairobi</div>
        <div className="flex items-center gap-2.5 text-sm text-muted">
          <SpinLoader size={16} label="" className="text-accent" />
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
              <Icon name="play" size={15} />Watch an ad <span className="font-mono font-medium text-accent">+4</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-[20px] border border-line bg-surface p-3 shadow-soft">
          <span className="flex-1 text-[15px] text-faint">Describe what to build</span>
          <span className="font-mono text-xs text-faint">Sonnet 5.5 · 12 cr</span>
          <span className="grid size-9 place-items-center rounded-full bg-fg text-bg"><Icon name="up" /></span>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { title: "Apply", text: "Tell us what you want to build. It takes a minute." },
  { title: "Get approved", text: "We open Wanlly in weekly groups. Friends you invite move you up." },
  { title: "Watch, then build", text: "Sponsor ads earn credits. Watch more whenever you need more, and use the world's top AI models." },
];

/** A select with an "Other" choice that opens a text box, so nobody is stuck with our list. */
function SelectOrType({ id, name, label, options, placeholder, required, field }: { id: string; name: string; label: string; options: string[]; placeholder: string; required?: boolean; field: string }) {
  const [value, setValue] = useState("");
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-medium" htmlFor={id}>
      {label}
      <select id={id} name={value === "Other" ? undefined : name} required={required} value={value} onChange={(e) => setValue(e.target.value)} className={field}>
        <option value="" disabled>Choose one</option>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
      {value === "Other" && <input name={name} required={required} autoFocus placeholder={placeholder} className={field} aria-label={`${label}: type your own`} />}
    </label>
  );
}

export function BetaPage() {
  const [sent, setSent] = useState<null | { name: string; code: string }>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body: Record<string, unknown> = Object.fromEntries(new FormData(e.currentTarget));
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && !body.ref) body.ref = ref;
    body.firstTouch = readFirstTouch();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/beta", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const out = await r.json();
      if (!r.ok) throw new Error(out.error || SAY.wrong);
      setSent({ name: String(body.name || "").trim().split(" ")[0], code: out.code });
    } catch (err) {
      setError(err instanceof Error ? err.message : SAY.wrong);
    } finally {
      setBusy(false);
    }
  }
  const link = sent && typeof window !== "undefined" ? `${window.location.origin}/beta?ref=${sent.code}` : "";

  const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg outline-none placeholder:text-faint focus:border-fg";

  return (
    <div className="min-h-full bg-bg">
      <main className="px-4">
        <section className="mx-auto flex max-w-[1100px] flex-col items-center gap-6 pt-16 pb-12 text-center sm:pt-24">
          <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">Private beta · opening in weekly groups</span>
          <h1 className="max-w-[16ch] font-display text-[clamp(40px,7vw,76px)] leading-[0.98] font-semibold tracking-[-0.04em] text-balance">
            Join the Wanlly beta.
          </h1>
          <p className="max-w-[56ch] text-[17px] text-muted text-balance">
            Chat, code and design with the world&apos;s top AI models. Watch sponsor ads, earn credits, build. No card. No subscription.
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
              Every ad you watch earns credits, and your first one each day earns a bonus. Sponsors sit beside your work, never inside an answer, and never change what a model says.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["1", "ad a day to start"],
              ["0", "subscriptions"],
              ["10+", "top AI models: Claude, Gemini, Grok, DeepSeek and more"],
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
                    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); }
                  }}
                  className="rounded-lg bg-fg px-3 py-1.5 text-[13px] font-semibold text-bg"
                >
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2 text-center">
                <h2 className="font-display text-[clamp(28px,4vw,40px)] font-semibold tracking-[-0.03em]">Apply for the beta</h2>
                <p className="text-muted">We review every application by hand.</p>
              </div>
              <form onSubmit={submit} className="flex flex-col gap-3.5">
                <label className="flex flex-col gap-1.5 text-[13px] font-medium" htmlFor="b-name">Name<input id="b-name" name="name" required autoComplete="name" className={field} /></label>
                <label className="flex flex-col gap-1.5 text-[13px] font-medium" htmlFor="b-email">Email<input id="b-email" name="email" type="email" required autoComplete="email" className={field} /></label>
                <SelectOrType id="b-country" name="country" label="Country" options={COUNTRIES} placeholder="Type your country" required field={field} />
                <label className="flex flex-col gap-1.5 text-[13px] font-medium" htmlFor="b-build">What do you want to build?
                  <textarea id="b-build" name="build" required rows={3} placeholder="A booking app for my cousin's salon, a study planner, a portfolio…" className={`${field} resize-none`} />
                </label>
                <SelectOrType id="b-source" name="source" label="How did you hear about Wanlly?" options={SOURCES} placeholder="Tell us where" required field={field} />
                <label className="flex flex-col gap-1.5 text-[13px] font-medium" htmlFor="b-ref">Invite code <span className="font-normal text-faint">optional</span>
                  <input id="b-ref" name="ref" className={field} />
                </label>
                <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
                {error && <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-[13px] text-bad">{error}</p>}
                <button type="submit" disabled={busy} className="mt-2 rounded-full bg-fg px-6 py-2.5 text-sm font-semibold text-bg disabled:opacity-60">{busy ? "Sending…" : "Apply"}</button>
                <p className="text-center text-xs text-faint">By applying you agree to hear from us about the beta. No spam, unsubscribe anytime.</p>
              </form>
            </>
          )}
        </section>
      </main>

    </div>
  );
}
