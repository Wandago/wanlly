"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { bannerFrom, pictureFrom } from "@/lib/ad-pictures";
import { CountryPicker } from "../admin/country-picker";
import { Icon } from "../icon";

/*
 * Self-serve: an advertiser builds the ad, picks where it runs, sets a budget and offers a price.
 * The team accepts or suggests another price; nothing runs or is charged until both agree.
 */

const CATEGORIES = ["Learning and courses", "Developer tools", "Laptops and phones", "Jobs and internships", "Money and banking", "Design tools", "Telecoms and data", "Student services", "Other"];
const SWATCHES = ["#2a78d6", "#0ea5e9", "#16a34a", "#0f766e", "#f59e0b", "#ff6a33", "#dc2626", "#db2777", "#7c3aed", "#111827"];
const BANNERS = ["300x250", "728x90", "320x50"] as const;
/** Starting prices (the server's GUIDE), in dollars. */
const GUIDE = { visualCpm: 3, suggestedCpm: 6, suggestedCpc: 0.1, minBudget: 20 };

const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg outline-none placeholder:text-faint focus:border-fg";
const label = "flex flex-col gap-1.5 text-[13px] font-medium";

function Step({ n, title, note, children }: { n: number; title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-line pt-6 first:border-t-0 first:pt-0">
      <header className="flex items-start gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-fg font-mono text-xs text-bg">{n}</span>
        <div className="flex flex-col gap-0.5">
          <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">{title}</h2>
          {note && <p className="text-[13px] text-muted">{note}</p>}
        </div>
      </header>
      <div className="flex flex-col gap-4 sm:pl-10">{children}</div>
    </section>
  );
}

export function CampaignBuilder() {
  const router = useRouter();
  const [f, setF] = useState({
    company: "",
    email: "",
    website: "",
    category: CATEGORIES[0],
    format: "visual" as "visual" | "suggested",
    headline: "",
    body: "",
    cta: "Learn more",
    url: "",
    color: SWATCHES[0],
    topics: "",
    startsAt: "",
    endsAt: "",
    budget: "50",
    pricing: "cpm" as "cpm" | "cpc",
    price: String(GUIDE.visualCpm),
    note: "",
    website2: "",
  });
  const [countries, setCountries] = useState<string[]>([]);
  const [image, setImage] = useState<string | null>(null);
  const [banners, setBanners] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const byClick = f.format === "suggested" && f.pricing === "cpc";
  const guide = f.format === "visual" ? GUIDE.visualCpm : byClick ? GUIDE.suggestedCpc : GUIDE.suggestedCpm;
  const price = Number(f.price) || 0;
  const budget = Number(f.budget) || 0;
  const reach = price > 0 ? Math.floor(byClick ? budget / price : (budget / price) * 1000) : 0;
  const topics = f.topics.split(",").map((t) => t.trim()).filter(Boolean);

  const pickFormat = (format: "visual" | "suggested") =>
    setF((x) => ({ ...x, format, pricing: "cpm", price: String(format === "visual" ? GUIDE.visualCpm : GUIDE.suggestedCpm) }));

  const onPicture = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    try {
      setImage(await pictureFrom(file));
      const out: Record<string, string> = {};
      for (const size of BANNERS) out[size] = await bannerFrom(file, size);
      setBanners(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That picture didn't work. Try a PNG or JPEG.");
    }
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    const cents = Math.round(price * 100);
    const r = await fetch("/api/advertise/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        company: f.company,
        email: f.email,
        website: f.website,
        category: f.category,
        format: f.format,
        headline: f.headline,
        body: f.body,
        cta: f.cta,
        url: /^https?:\/\//.test(f.url) ? f.url : f.url ? `https://${f.url}` : "",
        color: f.color,
        image,
        banners: f.format === "visual" ? banners : {},
        keywords: topics,
        countries,
        startsAt: f.startsAt || null,
        endsAt: f.endsAt || null,
        budgetCents: Math.round(budget * 100),
        pricing: byClick ? "cpc" : "cpm",
        ...(byClick ? { cpcCents: cents } : { cpmCents: cents }),
        note: f.note,
        website2: f.website2,
      }),
    }).catch(() => null);
    const b = await r?.json().catch(() => ({}));
    setBusy(false);
    if (!r?.ok || !b?.ref) return setError(b?.error ?? "We couldn't send that. Check your connection and try again.");
    router.push(`/advertise/c/${b.ref}`);
  };

  return (
    <main className="mx-auto grid w-full max-w-[1080px] gap-10 px-4 pt-12 pb-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      <form
        className="flex min-w-0 flex-col gap-8"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <header className="flex flex-col gap-2">
          <span className="text-xs font-medium tracking-[0.08em] text-accent uppercase">Advertise on Wanlly</span>
          <h1 className="font-display text-[clamp(28px,4vw,40px)] leading-[1.08] font-semibold tracking-[-0.03em] text-balance">Create your campaign</h1>
          <p className="max-w-[560px] text-[15px] text-muted">Build your ad, set a budget and offer a price. We reply within a working day to accept it or suggest another. Nothing runs and you pay nothing until we both agree.</p>
        </header>

        <Step n={1} title="Your business">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>
              Company or brand
              <input id="ad-company" required value={f.company} onChange={set("company")} maxLength={80} className={input} />
            </label>
            <label className={label}>
              Work email
              <input id="ad-email" required type="email" value={f.email} onChange={set("email")} className={input} placeholder="We send your private campaign link here" />
            </label>
            <label className={label}>
              <span className="flex items-baseline justify-between gap-2">
                Website <span className="font-normal text-faint">optional</span>
              </span>
              <input id="ad-website" value={f.website} onChange={set("website")} className={input} placeholder="yourbrand.com" />
            </label>
            <label className={label}>
              What you sell
              <select id="ad-category" value={f.category} onChange={set("category")} className={input}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website2} onChange={set("website2")} className="hidden" />
        </Step>

        <Step n={2} title="Where it shows" note="One format per campaign. Want both? Create a second one after this.">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["visual", "grid", "Visual ads", "Your picture as banners and sponsor cards beside people's work: side panels, under the chat box, over the code, the phone bar. Priced per 1,000 views."],
                ["suggested", "chat", "Suggested in chat", "One sponsored card under an AI answer when the conversation matches your topics, like ads in ChatGPT. Never inside the answer. Per 1,000 views or per click."],
              ] as const
            ).map(([id, icon, title, text]) => (
              <button
                key={id}
                type="button"
                aria-pressed={f.format === id}
                onClick={() => pickFormat(id)}
                className={`flex flex-col gap-1.5 rounded-2xl border p-4 text-left transition-colors ${f.format === id ? "border-fg bg-surface" : "border-line bg-surface/60 hover:border-faint"}`}
              >
                <b className="flex items-center gap-2 text-[15px] font-semibold">
                  <Icon name={icon} size={16} className={f.format === id ? "text-accent" : "text-faint"} /> {title}
                </b>
                <span className="text-[13px] leading-relaxed text-muted">{text}</span>
              </button>
            ))}
          </div>
        </Step>

        <Step n={3} title="Your ad" note="Short and specific works best. Your link opens in a new tab, tagged so your own analytics see Wanlly.">
          <label className={label}>
            <span className="flex items-baseline justify-between gap-2">
              Headline <span className="font-normal text-faint">{f.headline.length}/60</span>
            </span>
            <input id="ad-headline" required value={f.headline} onChange={set("headline")} maxLength={60} className={input} placeholder="Student laptops from $299" />
          </label>
          <label className={label}>
            <span className="flex items-baseline justify-between gap-2">
              One line about it <span className="font-normal text-faint">{f.body.length}/120</span>
            </span>
            <input id="ad-body" value={f.body} onChange={set("body")} maxLength={120} className={input} placeholder="Verify your student email and save up to 20%." />
          </label>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
            <label className={label}>
              Link
              <input id="ad-url" required value={f.url} onChange={set("url")} className={input} placeholder="https://yourbrand.com/students" />
            </label>
            <label className={label}>
              Button
              <input id="ad-cta" value={f.cta} onChange={set("cta")} maxLength={20} className={input} />
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-6">
            <div className={label}>
              Brand colour
              <div className="flex flex-wrap gap-1.5">
                {SWATCHES.map((c) => (
                  <button key={c} type="button" aria-label={c} aria-pressed={f.color === c} onClick={() => setF((x) => ({ ...x, color: c }))} className={`size-7 rounded-full border-2 ${f.color === c ? "border-fg" : "border-transparent"}`} style={{ background: c }} />
                ))}
              </div>
            </div>
            <label className={label}>
              <span className="flex items-baseline justify-between gap-2">
                Picture <span className="font-normal text-faint">{f.format === "visual" ? "we make the banner sizes from it" : "optional, square works best"}</span>
              </span>
              <input id="ad-picture" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void onPicture(e.target.files?.[0])} className="text-[13px] file:mr-2 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-[13px]" />
            </label>
          </div>
          {f.format === "suggested" && (
            <label className={label}>
              <span className="flex items-baseline justify-between gap-2">
                Topics to match <span className="font-normal text-faint">comma separated, at least two</span>
              </span>
              <input id="ad-topics" value={f.topics} onChange={set("topics")} className={input} placeholder="laptop, coding, computer science, react, web development" />
              <span className="text-xs font-normal text-faint">Your card shows when someone&apos;s question is about these. Never on health, mental health, politics or money-trouble conversations.</span>
            </label>
          )}
        </Step>

        <Step n={4} title="Who sees it">
          <div className={label}>
            <span className="flex items-baseline justify-between gap-2">
              Countries <span className="font-normal text-faint">leave empty for everywhere</span>
            </span>
            <CountryPicker value={countries} onChange={setCountries} input={input} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>
              <span className="flex items-baseline justify-between gap-2">
                Start <span className="font-normal text-faint">optional</span>
              </span>
              <input id="ad-start" type="date" value={f.startsAt} onChange={set("startsAt")} className={input} />
            </label>
            <label className={label}>
              <span className="flex items-baseline justify-between gap-2">
                End <span className="font-normal text-faint">optional</span>
              </span>
              <input id="ad-end" type="date" value={f.endsAt} onChange={set("endsAt")} className={input} />
            </label>
          </div>
        </Step>

        <Step n={5} title="Budget and your price" note="Offer what it's worth to you. We accept, or suggest a price, and you decide.">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>
              <span className="flex items-baseline justify-between gap-2">
                Total budget (US$) <span className="font-normal text-faint">from ${GUIDE.minBudget}</span>
              </span>
              <input id="ad-budget" type="number" min={GUIDE.minBudget} step="1" value={f.budget} onChange={set("budget")} className={input} />
            </label>
            {f.format === "suggested" && (
              <div className={label}>
                Pay
                <div className="flex gap-1 rounded-lg bg-hover p-1" role="group" aria-label="Pay per">
                  {(
                    [
                      ["cpm", "Per 1,000 views"],
                      ["cpc", "Per click"],
                    ] as const
                  ).map(([id, t]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={f.pricing === id}
                      onClick={() => setF((x) => ({ ...x, pricing: id, price: String(id === "cpc" ? GUIDE.suggestedCpc : GUIDE.suggestedCpm) }))}
                      className={`flex-1 rounded-md px-2 py-1.5 text-[13px] ${f.pricing === id ? "bg-surface font-medium shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label className={label}>
              <span className="flex items-baseline justify-between gap-2">
                Your price (US$ {byClick ? "per click" : "per 1,000 views"}) <span className="font-normal text-faint">we suggest from ${guide}</span>
              </span>
              <input id="ad-price" type="number" min="0.01" step="0.01" value={f.price} onChange={set("price")} className={input} />
            </label>
          </div>
          <p className="rounded-xl bg-hover px-4 py-3 text-[13px]">
            {reach > 0 ? (
              <>
                ${budget.toLocaleString("en-US")} at ${price.toFixed(2)} {byClick ? "a click" : "per 1,000"} buys about <b>{reach.toLocaleString("en-US")}</b> {byClick ? "clicks" : "views"}. The campaign stops when the budget is spent.
              </>
            ) : (
              "Set a budget and a price to see your reach."
            )}
          </p>
          <label className={label}>
            <span className="flex items-baseline justify-between gap-2">
              Anything we should know <span className="font-normal text-faint">optional</span>
            </span>
            <textarea id="ad-note" value={f.note} onChange={set("note")} rows={3} maxLength={500} className={`${input} resize-y`} placeholder="Launch dates, a student offer, who you want to reach…" />
          </label>
        </Step>

        {error && <p className="text-sm text-bad">{error}</p>}
        <div className="flex flex-wrap items-center gap-3 sm:pl-10">
          <button type="submit" disabled={busy} className="rounded-full bg-fg px-6 py-3 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-60">
            {busy ? "Sending…" : "Send for review"}
          </button>
          <span className="text-xs text-muted">No payment now. You&apos;ll get a private link to follow it.</span>
        </div>
      </form>

      <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
        <span className="text-[11px] font-medium tracking-[0.08em] text-faint uppercase">Preview</span>
        {f.format === "visual" ? <VisualPreview f={f} image={image} banners={banners} /> : <SuggestedPreview f={f} image={image} topics={topics} />}
        <p className="text-xs leading-relaxed text-faint">Every ad is labelled Sponsored. Advertisers never see anyone&apos;s prompts, chats or personal details: you get views, clicks and spend.</p>
      </aside>
    </main>
  );
}

type Fields = { company: string; headline: string; body: string; cta: string; color: string };

function Mark({ f, image, size = 36 }: { f: Fields; image: string | null; size?: number }) {
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className="shrink-0 rounded-xl object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-xl text-sm font-bold text-white" style={{ width: size, height: size, background: f.color }}>
      {(f.company || "A").charAt(0).toUpperCase()}
    </span>
  );
}

function VisualPreview({ f, image, banners }: { f: Fields; image: string | null; banners: Record<string, string> }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-36 w-full object-cover" />
        ) : (
          <div className="h-36" style={{ background: f.color }} />
        )}
        <div className="flex flex-col gap-1.5 p-4">
          <div className="flex items-center gap-2 text-xs">
            <b className="text-[13px]">{f.company || "Your brand"}</b>
            <span className="tracking-[0.07em] text-faint uppercase">Sponsored</span>
          </div>
          <b className="text-[15px] font-semibold">{f.headline || "Your headline"}</b>
          {f.body && <p className="text-[13px] text-muted">{f.body}</p>}
          <span className="mt-1 self-start rounded-lg border border-line px-3 py-1.5 text-xs font-medium">{f.cta || "Learn more"}</span>
        </div>
      </div>
      <span className="text-xs text-muted">Sponsor card in the side panel</span>
      {banners["320x50"] && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banners["320x50"]} alt="" width={320} height={50} className="max-w-full rounded-md" />
          <span className="text-xs text-muted">Phone banner, 320×50 (also 300×250 and 728×90)</span>
        </>
      )}
    </div>
  );
}

function SuggestedPreview({ f, image, topics }: { f: Fields; image: string | null; topics: string[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-bg p-4">
      <div className="self-end rounded-[16px_16px_6px_16px] bg-hover px-3 py-2 text-[13px]">What should I know before buying a {topics[0] || "laptop"} for school?</div>
      <div className="flex flex-col gap-1.5 text-[13px] text-muted">
        <i className="h-2 w-[92%] rounded-full bg-line" />
        <i className="h-2 w-[80%] rounded-full bg-line" />
        <i className="h-2 w-[86%] rounded-full bg-line" />
        <i className="h-2 w-[54%] rounded-full bg-line" />
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
        <Mark f={f} image={image} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs">
            <b className="truncate text-[13px]">{f.company || "Your brand"}</b>
            <span className="tracking-[0.07em] text-faint uppercase">Sponsored</span>
          </div>
          <p className="text-[13px] font-medium">{f.headline || "Your headline"}</p>
          {f.body && <p className="truncate text-xs text-muted">{f.body}</p>}
        </div>
        <span className="shrink-0 rounded-lg bg-fg px-2.5 py-1.5 text-xs font-semibold text-bg">{f.cta || "Learn more"}</span>
      </div>
      <span className="text-xs text-muted">Shows under the answer when the question matches: {topics.length ? topics.slice(0, 4).join(", ") : "your topics"}.</span>
    </div>
  );
}
