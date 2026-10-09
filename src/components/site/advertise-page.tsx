"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Icon, type IconName } from "../icon";

const CATEGORIES = ["Learning and courses", "Developer tools", "Laptops and phones", "Jobs and internships", "Money and banking", "Design tools", "Telecoms and data", "Student services", "Other"];
const BUDGETS = ["Under $100 (a test)", "$100 to $500", "$500 to $2,000", "$2,000 or more", "Not sure yet"];
const FORMATS = ["Sponsor cards", "Banners", "Sponsored videos", "Pop-up cards", "Sponsor trials"];
const NOT_ACCEPTED = [
  "Gambling, betting and loans with hidden fees",
  "Alcohol, tobacco, vaping and adult content",
  "Get-rich-quick schemes, crypto trading signals and MLM",
  "Essay mills and anything that helps people cheat",
  "Political and religious campaigning",
];

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg outline-none placeholder:text-faint focus:border-fg";

function Format({ icon, title, text, children }: { icon: IconName; title: string; text: string; children: ReactNode }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="grid h-[150px] place-items-center border-b border-line bg-code p-4">{children}</div>
      <div className="flex flex-col gap-1 p-4">
        <b className="flex items-center gap-2 text-[15px] font-semibold">
          <Icon name={icon} size={16} className="text-faint" /> {title}
        </b>
        <p className="text-[13px] leading-relaxed text-muted">{text}</p>
      </div>
    </article>
  );
}

/* Small flat previews of each format, drawn with the app's own tokens. */
const Card = () => (
  <div className="w-[190px] overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
    <div className="h-14 bg-[#2a78d6]" />
    <div className="flex flex-col gap-1 p-2.5">
      <i className="h-2 w-24 rounded-full bg-fg/80" />
      <i className="h-1.5 w-32 rounded-full bg-line" />
      <i className="mt-1 h-5 w-16 rounded-md border border-line" />
    </div>
  </div>
);
const Banner = () => (
  <div className="flex flex-col items-center gap-2">
    <div className="flex h-[70px] w-[84px] flex-col justify-end gap-1 rounded-lg bg-[#1e7a55] p-2">
      <i className="h-1.5 w-12 rounded-full bg-white/80" />
      <i className="h-3 w-10 rounded-full bg-white" />
    </div>
    <div className="flex h-5 w-[150px] items-center gap-1.5 rounded bg-[#b4235a] px-1.5">
      <i className="size-3 rounded-sm bg-white/80" />
      <i className="h-1.5 w-20 rounded-full bg-white/80" />
    </div>
  </div>
);
const Video = () => (
  <div className="w-[200px] overflow-hidden rounded-xl border border-line bg-surface">
    <div className="grid h-[90px] place-items-center bg-[#16171b]">
      <span className="grid size-8 place-items-center rounded-full bg-white/90 text-[#16171b]">
        <Icon name="play" size={14} />
      </span>
    </div>
    <div className="flex items-center gap-2 px-2.5 py-1.5 font-mono text-[10px] text-muted">
      0:12 <i className="h-1 flex-1 rounded-full bg-accent" /> +4
    </div>
  </div>
);
const Popup = () => (
  <div className="relative grid h-[110px] w-[200px] place-items-center rounded-xl bg-[rgb(8_9_12/0.35)]">
    <div className="w-[130px] overflow-hidden rounded-lg bg-surface shadow-soft">
      <div className="h-10 bg-[#c2410c]" />
      <div className="flex flex-col gap-1 p-2">
        <i className="h-1.5 w-20 rounded-full bg-fg/80" />
        <i className="h-4 w-14 rounded-md bg-fg" />
      </div>
    </div>
    <span className="absolute top-2 right-2 rounded-full bg-surface px-1.5 font-mono text-[9px] text-muted">Close in 5</span>
  </div>
);
const Trial = () => (
  <div className="flex w-[200px] items-center gap-2.5 rounded-xl border border-line bg-surface p-2.5">
    <span className="grid size-8 place-items-center rounded-lg bg-hover">
      <Icon name="gift" size={15} />
    </span>
    <span className="flex flex-1 flex-col gap-1">
      <i className="h-1.5 w-20 rounded-full bg-fg/80" />
      <i className="h-1.5 w-28 rounded-full bg-line" />
    </span>
    <b className="font-mono text-[11px] text-accent">+25</b>
  </div>
);

export function AdvertisePage() {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("sending");
    setError("");
    try {
      const r = await fetch("/api/advertise", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...Object.fromEntries(f), formats: f.getAll("formats") }),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b.error ?? "Something went wrong");
      setState("done");
    } catch (err) {
      setError((err as Error).message);
      setState("error");
    }
  };

  return (
    <div className="flex flex-col">
      <section className="mx-auto flex w-full max-w-[1080px] flex-col items-start gap-5 px-4 pt-16 pb-12 sm:px-6 sm:pt-24">
        <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">Advertise with Wanlly</span>
        <h1 className="max-w-[760px] font-display text-[clamp(34px,5.4vw,58px)] leading-[1.04] font-semibold tracking-[-0.035em] text-balance">
          Reach students and young creators while they build.
        </h1>
        <p className="max-w-[620px] text-[17px] leading-relaxed text-muted">
          Wanlly is free AI for chat, code and design, paid for by sponsors. People see your brand while their work is being made, and many choose to watch your video
          to earn credits.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="#apply" className="rounded-full bg-fg px-5 py-2.5 text-sm font-semibold text-bg hover:opacity-90">
            Apply to advertise
          </a>
          <a href="#formats" className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-medium hover:border-faint">
            See the formats
          </a>
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-[1080px] gap-px bg-line sm:grid-cols-3">
          {(
            [
              ["clock", "Attention, not scrolling", "Ads sit beside the work while the AI writes, so they're seen for seconds, not skipped in a feed."],
              ["users", "An audience that's hard to reach", "Students and early-career creators, starting across Africa and Asia, often on their first laptop or phone plan."],
              ["shield", "Brand-safe by design", "Every ad is labelled. Nothing appears inside an AI answer, nothing blocks a result, and clicks are never rewarded."],
            ] as const
          ).map(([icon, t, d]) => (
            <div key={t} className="flex flex-col gap-2 bg-surface p-6">
              <Icon name={icon} size={20} className="text-accent" />
              <b className="text-[15px] font-semibold">{t}</b>
              <p className="text-[13px] leading-relaxed text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="formats" className="mx-auto flex w-full max-w-[1080px] scroll-mt-20 flex-col gap-6 px-4 py-16 sm:px-6">
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.025em]">Formats</h2>
          <p className="max-w-[620px] text-[15px] text-muted">Mix any of them in one campaign. You choose the countries; we report views, clicks and click rate every week.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Format icon="grid" title="Sponsor cards" text="A card with your picture, one line and a button, in the side panels people keep open while they work.">
            <Card />
          </Format>
          <Format icon="images" title="Banners" text="Standard sizes (300×250, 320×50 on phones) in the same rounded frame, so they never look pasted in.">
            <Banner />
          </Format>
          <Format icon="play" title="Sponsored videos" text="15 to 20 seconds, watched by choice to earn credits. Full attention, finished views only.">
            <Video />
          </Format>
          <Format icon="bolt" title="Pop-up cards" text="A full card at a natural break, right after a reply or design finishes. Never while someone types, and capped per person.">
            <Popup />
          </Format>
          <Format icon="gift" title="Sponsor trials" text="People earn credits for trying your product: creating an account, a free course, a first deploy.">
            <Trial />
          </Format>
          <article className="flex flex-col justify-center gap-2 rounded-2xl border border-dashed border-line p-6">
            <b className="text-[15px] font-semibold">Pricing</b>
            <p className="text-[13px] leading-relaxed text-muted">
              Priced per 1,000 views and agreed with you per campaign, with a cap so you never spend more than you planned. Small tests are welcome.
            </p>
          </article>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1080px] gap-10 px-4 pb-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.025em]">How it works</h2>
          <ol className="flex flex-col gap-3">
            {[
              ["Apply", "Tell us about your product and budget. It takes two minutes."],
              ["Agree the campaign", "We reply within a few days with placements, countries, dates and a price per 1,000 views."],
              ["Go live", "Send your picture, headline and link. Your ads run in Wanlly, labelled as sponsored."],
              ["See the results", "Views, clicks and click rate, every week, and links tagged so your own analytics see Wanlly."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-hover font-mono text-xs">{i + 1}</span>
                <span>
                  <b className="block text-[14px] font-semibold">{t}</b>
                  <span className="text-[13px] text-muted">{d}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-2 rounded-2xl border border-line bg-surface p-5">
            <b className="text-[14px] font-semibold">What we don&apos;t advertise</b>
            <ul className="mt-2 flex flex-col gap-1 text-[13px] text-muted">
              {NOT_ACCEPTED.map((n) => (
                <li key={n} className="flex gap-2">
                  <Icon name="x" size={14} className="mt-0.5 shrink-0 text-faint" /> {n}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-faint">Ads are matched to the page and the topics people choose. Advertisers never see anyone&apos;s prompts, work or personal details.</p>
          </div>
        </div>

        <div id="apply" className="scroll-mt-20 rounded-3xl border border-line bg-surface p-6 shadow-soft sm:p-8">
          {state === "done" ? (
            <div className="flex flex-col items-start gap-3 py-8">
              <span className="grid size-11 place-items-center rounded-full bg-good/12 text-good">
                <Icon name="check" />
              </span>
              <h2 className="font-display text-2xl font-semibold">Thanks, we&apos;ve got it.</h2>
              <p className="text-[15px] text-muted">We&apos;ll reply by email within a few days with what we can offer.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <div>
                <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]">Apply to advertise</h2>
                <p className="mt-1 text-[13px] text-muted">No commitment. We&apos;ll come back with a proposal.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                  Company or brand
                  <input name="company" required maxLength={120} className={field} placeholder="Lumen Laptops" />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                  Your name
                  <input name="name" required maxLength={120} className={field} autoComplete="name" />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                  Work email
                  <input name="email" type="email" required maxLength={254} className={field} autoComplete="email" />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                  Website
                  <input name="website" maxLength={300} className={field} placeholder="https://" />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                  What you offer
                  <select name="category" required defaultValue="" className={field}>
                    <option value="" disabled>
                      Choose one
                    </option>
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                  Monthly budget
                  <select name="budget" defaultValue="" className={field}>
                    <option value="" disabled>
                      Choose one
                    </option>
                    {BUDGETS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-medium sm:col-span-2">
                  Countries you want to reach
                  <input name="country" maxLength={80} className={field} placeholder="Kenya, Nigeria, or everywhere" />
                </label>
              </div>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1.5 text-[13px] font-medium">Formats you&apos;re interested in</legend>
                <div className="flex flex-wrap gap-2">
                  {FORMATS.map((f) => (
                    <label key={f} className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5 text-[13px] has-[:checked]:border-accent-line has-[:checked]:bg-accent-soft has-[:checked]:text-accent">
                      <input type="checkbox" name="formats" value={f} className="sr-only" />
                      {f}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                Anything else
                <textarea name="message" maxLength={2000} className={`${field} min-h-24 resize-y`} placeholder="Your goal, dates, or questions" />
              </label>
              <input name="website2" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              {error && <p className="text-[13px] text-bad">{error}</p>}
              <button type="submit" disabled={state === "sending"} className="self-start rounded-full bg-fg px-5 py-2.5 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-60">
                {state === "sending" ? "Sending…" : "Send application"}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
