import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "../icon";

/* The public home page. The hero is deliberately dark in both themes; the rest follows the theme. */

const MODELS = ["Claude Haiku 5.5", "Claude Sonnet 5.5", "Claude Opus 5.5", "Claude Fable 5.1", "Gemini Flash", "GPT · soon", "Grok · soon", "Image models · soon"];

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-[#0b0c10] text-white">
      {/* Aurora */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="anim-aurora-a absolute -top-1/3 left-[-10%] h-[70vh] w-[60vw] rounded-full bg-[radial-gradient(closest-side,rgba(255,90,31,0.55),transparent)] blur-3xl" />
        <div className="anim-aurora-b absolute top-[5%] right-[-15%] h-[65vh] w-[55vw] rounded-full bg-[radial-gradient(closest-side,rgba(124,92,255,0.45),transparent)] blur-3xl" />
        <div className="anim-aurora-a absolute bottom-[-30%] left-[25%] h-[55vh] w-[50vw] rounded-full bg-[radial-gradient(closest-side,rgba(20,184,166,0.28),transparent)] blur-3xl [animation-delay:-9s]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] bg-[size:56px_56px]" />
      </div>

      <div className="mx-auto flex max-w-[1180px] flex-col items-center gap-7 px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28">
        <Link
          href="/beta"
          className="anim-rise inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80 backdrop-blur hover:bg-white/10"
        >
          <span className="size-1.5 rounded-full bg-[#ff6a33] shadow-[0_0_10px_#ff6a33]" />
          Private beta now open in weekly groups
          <span aria-hidden="true">→</span>
        </Link>
        <h1 className="anim-rise max-w-[15ch] font-display text-[clamp(40px,7vw,80px)] leading-[0.98] font-semibold tracking-[-0.045em] text-balance [animation-delay:80ms]">
          Frontier AI for <span className="text-shimmer">everyone with an idea.</span>
        </h1>
        <p className="anim-rise max-w-[58ch] text-[clamp(15px,1.6vw,18px)] text-white/70 text-balance [animation-delay:160ms]">
          Chat, code and design with Claude and Gemini. No card and no subscription: one short video a day unlocks your floor, and it&apos;s the same wherever you live.
        </p>
        <div className="anim-rise flex flex-wrap justify-center gap-3 [animation-delay:240ms]">
          <Link href="/beta" className="rounded-full bg-[#ff5a1f] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(255,90,31,0.45)] hover:bg-[#ff6a33]">
            Join the beta
          </Link>
          <Link href="/#how" className="rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white backdrop-blur hover:bg-white/10">
            How it&apos;s free
          </Link>
        </div>

        <ProductPreview />
      </div>
    </section>
  );
}

/** A still of the app, drawn with real markup so it stays sharp and themable. */
function ProductPreview() {
  return (
    <div className="anim-rise relative mt-10 w-full max-w-[980px] [animation-delay:320ms]">
      <div aria-hidden="true" className="absolute -inset-x-10 -top-10 bottom-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(255,90,31,0.35),transparent_60%)] blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-2 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)] backdrop-blur">
        <div className="grid overflow-hidden rounded-xl bg-[#fbfbfc] text-left text-[#15171c] md:grid-cols-[180px_minmax(0,1fr)_200px]">
          <aside className="hidden flex-col gap-1 border-r border-[#e3e5eb] bg-[#f3f4f7] p-3 text-xs md:flex">
            <div className="flex items-center gap-1.5 px-1 pb-2 font-display text-sm font-semibold">
              <span className="grid size-4 place-items-center rounded bg-[#15171c]">
                <span className="size-1.5 rounded-full bg-[#ff5a1f]" />
              </span>
              Wanlly
            </div>
            {["Chat", "Code", "Design", "Projects", "Coworkers"].map((t, i) => (
              <span key={t} className={`rounded-md px-2 py-1 ${i === 1 ? "bg-[#e9ebf0] font-medium" : "text-[#636a78]"}`}>
                {t}
              </span>
            ))}
            <div className="mt-auto rounded-lg border border-[#e3e5eb] bg-white p-2">
              <div className="flex justify-between text-[10px] text-[#636a78]">
                <span>Today&apos;s floor</span>
                <b className="text-[#15171c]">16 cr</b>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-[#e9ebf0]">
                <i className="block h-full w-3/4 rounded-full bg-[#ff5a1f]" />
              </div>
            </div>
          </aside>
          <div className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
            <div className="max-w-[85%] self-end rounded-[14px_14px_4px_14px] bg-[#e9ebf0] px-3 py-2 text-[13px]">Build a booking page for my cousin&apos;s salon in Nairobi</div>
            <div className="flex items-center gap-2 text-xs text-[#636a78]">
              <span className="size-3 animate-spin rounded-full border-2 border-[#ffd2bf] border-t-[#ff5a1f]" />
              Writing the booking form
              <span className="ml-auto font-mono text-[10px]">0:14</span>
            </div>
            <div className="rounded-lg border border-[#e3e5eb] bg-[#f4f5f8] p-3 font-mono text-[11px] leading-relaxed">
              <span className="text-[#c2410c]">export</span> <span className="text-[#2a78d6]">function</span> Booking() {"{"}
              <br />
              &nbsp;&nbsp;const slots = useSlots(&quot;Sat&quot;);
              <br />
              &nbsp;&nbsp;<span className="text-[#11955a]">return</span> &lt;Calendar slots={"{"}slots{"}"} /&gt;;
              <br />
              {"}"}
            </div>
            <div className="mt-auto flex items-center gap-2 rounded-xl border border-[#e3e5eb] bg-white p-2 pl-3 text-[13px] shadow-sm">
              <span className="flex-1 text-[#9aa0ac]">Describe a change…</span>
              <span className="rounded-full bg-[#e9ebf0] px-2 py-0.5 font-mono text-[10px] text-[#636a78]">Gemini Flash · 1 cr</span>
              <span className="grid size-7 place-items-center rounded-full bg-[#15171c] text-white">
                <Icon name="up" size={14} />
              </span>
            </div>
          </div>
          <aside className="hidden flex-col gap-2 border-l border-[#e3e5eb] bg-[#f3f4f7] p-3 md:flex">
            <div className="overflow-hidden rounded-lg border border-[#e3e5eb] bg-white">
              <div className="h-16 bg-[linear-gradient(135deg,#6d63f0,#3730a3)]" />
              <div className="p-2">
                <span className="text-[9px] tracking-wider text-[#9aa0ac] uppercase">Sponsored</span>
                <p className="text-[11px] font-semibold">Student pricing on every laptop.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#ffd2bf] bg-[#ffeee6] p-2 text-[10px]">
              <Icon name="play" size={12} className="text-[#ff5a1f]" />
              <span className="flex-1">Watch 20s</span>
              <b className="text-[#c2410c]">+4</b>
            </div>
          </aside>
        </div>
      </div>
      <span className="anim-float absolute top-[8%] -left-16 hidden rounded-full border border-white/15 bg-[#15171c]/90 px-3 py-1.5 text-xs text-white shadow-xl backdrop-blur xl:block">
        ✓ Same floor in Nairobi and Boston
      </span>
      <span className="anim-float absolute -right-16 bottom-[8%] hidden rounded-full border border-white/15 bg-[#15171c]/90 px-3 py-1.5 text-xs text-white shadow-xl backdrop-blur [animation-delay:-3s] xl:block">
        Pull request opened · tests pass
      </span>
    </div>
  );
}

function ModelStrip() {
  const row = [...MODELS, ...MODELS];
  return (
    <section aria-label="Models" className="border-y border-line bg-side py-5">
      <div className="mx-auto flex max-w-[1180px] items-center gap-6 overflow-hidden px-4 sm:px-6">
        <span className="shrink-0 text-[11px] font-medium tracking-[0.08em] text-faint uppercase">Runs on</span>
        <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
          <div className="anim-marquee flex w-max gap-10">
            {row.map((m, i) => (
              <span key={i} className="font-display text-[15px] font-medium whitespace-nowrap text-muted">
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title, text, center = false }: { eyebrow: string; title: ReactNode; text?: string; center?: boolean }) {
  return (
    <div className={`flex max-w-[640px] flex-col gap-3 ${center ? "mx-auto items-center text-center" : ""}`}>
      <span className="text-xs font-medium tracking-[0.08em] text-accent uppercase">{eyebrow}</span>
      <h2 className="font-display text-[clamp(28px,3.6vw,42px)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">{title}</h2>
      {text && <p className="text-[15px] text-muted text-balance">{text}</p>}
    </div>
  );
}

const FEATURES: { icon: IconName; title: string; text: string; span?: string; visual: ReactNode }[] = [
  {
    icon: "chat",
    title: "Chat",
    text: "Ask, plan, write and learn. Smart pick suggests the cheapest model that will do the job well.",
    span: "md:col-span-2",
    visual: (
      <div className="flex flex-col gap-2 text-[12px]">
        <span className="self-end rounded-[12px_12px_3px_12px] bg-hover px-3 py-1.5">Plan the database for my salon app</span>
        <span className="flex items-center gap-2 rounded-lg border border-accent-line bg-accent-soft px-3 py-1.5">
          ✦ <b className="font-medium">This one deserves Sonnet.</b> <span className="text-muted">About 6 credits.</span>
        </span>
      </div>
    ),
  },
  {
    icon: "code",
    title: "Code",
    text: "Connect GitHub. Wanlly reads your repo, makes the change, runs tests and opens a pull request.",
    visual: (
      <div className="flex flex-col gap-1 font-mono text-[11px]">
        <span className="text-good">+ export async function debit()</span>
        <span className="text-bad">- // TODO: track usage</span>
        <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-md bg-fg px-2 py-1 text-bg">
          <Icon name="pr" size={12} /> Open pull request
        </span>
      </div>
    ),
  },
  {
    icon: "design",
    title: "Design",
    text: "Describe a page or a screen and watch it appear. Keep refining it in plain words.",
    visual: (
      <div className="mx-auto flex h-[92px] w-[52px] flex-col gap-1 rounded-[10px] border-[3px] border-fg bg-[#fff7f2] p-1.5">
        <i className="h-1 w-6 rounded bg-[#1b1310]" />
        <i className="h-5 rounded bg-[#ff5a1f]" />
        <i className="mt-auto h-2 rounded bg-[#1b1310]" />
      </div>
    ),
  },
  {
    icon: "folder",
    title: "Projects",
    text: "Keep chats, files and instructions together for each thing you build, and invite teammates.",
    visual: (
      <div className="grid grid-cols-3 gap-1.5">
        {["var(--fg)", "#ff5a1f", "#2a78d6"].map((c) => (
          <i key={c} className="h-10 rounded-md" style={{ background: c }} />
        ))}
      </div>
    ),
  },
  {
    icon: "users",
    title: "Coworkers",
    text: "AI teammates that test your app, draft posts or research on a schedule. They always ask before anything goes out.",
    visual: (
      <div className="flex flex-col gap-1.5 text-[11px]">
        {[
          ["T", "#2a78d6", "Tess · testing bookings"],
          ["R", "#c2410c", "Rafi · needs your OK"],
        ].map(([l, c, t]) => (
          <span key={t} className="flex w-fit items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-2.5 pl-1">
            <span className="grid size-5 place-items-center rounded-full text-[10px] font-semibold text-white" style={{ background: c }}>
              {l}
            </span>
            {t}
          </span>
        ))}
      </div>
    ),
  },
];

function Features() {
  return (
    <section id="product" className="mx-auto flex max-w-[1180px] scroll-mt-20 flex-col gap-10 px-4 py-24 sm:px-6">
      <SectionHead eyebrow="Product" title="Everything you need to go from idea to launch." text="One workspace for chatting, coding and designing, with the models people use at the top labs and startups." />
      <div className="grid gap-4 md:grid-cols-3">
        {FEATURES.map((f) => (
          <article key={f.title} className={`group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-line bg-surface p-5 transition-shadow hover:shadow-soft ${f.span ?? ""}`}>
            <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-[radial-gradient(closest-side,var(--accent-soft),transparent)] opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-hover text-fg">
                <Icon name={f.icon} size={16} />
              </span>
              <h3 className="font-display text-base font-semibold">{f.title}</h3>
            </div>
            <p className="text-sm text-muted">{f.text}</p>
            <div className="mt-auto rounded-xl border border-line bg-bg p-3">{f.visual}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function HowFree() {
  const steps = [
    ["Watch one video", "Twenty seconds unlocks today's floor: about an hour of building with a fast model."],
    ["Build on any model", "Use your credits on Claude or Gemini. Bigger models use them faster; you always see the cost first."],
    ["Earn more if you need it", "Extra videos, short surveys and sponsor trials add credits. Nothing is ever charged to a card."],
  ];
  return (
    <section id="how" className="scroll-mt-20 border-y border-line bg-side">
      <div className="mx-auto grid max-w-[1180px] gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
        <SectionHead
          eyebrow="How it's free"
          title="Sponsors pay. You build."
          text="Brands pay to meet curious, ambitious people. When you choose to watch, they pay for your AI. Ads sit beside your work, never inside an answer, and never change what a model says."
        />
        <ol className="flex flex-col gap-3">
          {steps.map(([t, d], i) => (
            <li key={t} className="flex gap-4 rounded-2xl border border-line bg-surface p-5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-fg font-mono text-xs text-bg">{i + 1}</span>
              <div className="flex flex-col gap-1">
                <b className="font-semibold">{t}</b>
                <p className="text-sm text-muted">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const CITIES: [number, number, string][] = [
  [52, 56, "Nairobi"],
  [47, 52, "Lagos"],
  [70, 40, "Dhaka"],
  [26, 40, "Boston"],
  [33, 70, "São Paulo"],
  [81, 58, "Manila"],
  [47, 33, "London"],
  [62, 50, "Mumbai"],
];

function Worldwide() {
  return (
    <section className="relative isolate overflow-hidden bg-[#0b0c10] text-white">
      <div aria-hidden="true" className="anim-aurora-b absolute -bottom-1/3 left-1/4 -z-10 h-[60vh] w-[60vw] rounded-full bg-[radial-gradient(closest-side,rgba(255,90,31,0.3),transparent)] blur-3xl" />
      <div className="mx-auto grid max-w-[1180px] items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <span className="text-xs font-medium tracking-[0.08em] text-[#ff8a5c] uppercase">For students and creators everywhere</span>
          <h2 className="font-display text-[clamp(28px,3.6vw,42px)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">Where you live never decides whether you can build.</h2>
          <p className="max-w-[52ch] text-[15px] text-white/70">
            Ads pay ten times more in some countries than others. So part of every ad goes into a community pool that gives everyone the same daily floor, from Nairobi to Boston.
          </p>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {[
              ["1", "video a day"],
              ["Same", "floor everywhere"],
              ["0", "cards needed"],
            ].map(([n, l]) => (
              <div key={l} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <b className="font-display text-2xl font-semibold">{n}</b>
                <p className="text-xs text-white/60">{l}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.18)_1px,transparent_1.5px)] bg-[size:14px_14px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
          {CITIES.map(([x, y, name], i) => (
            <span key={name} className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5" style={{ left: `${x}%`, top: `${y}%` }}>
              <span className="relative grid size-2.5 place-items-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-[#ff6a33]/60" style={{ animationDelay: `${i * 0.4}s`, animationDuration: "2.4s" }} />
                <span className="size-2.5 rounded-full bg-[#ff6a33]" />
              </span>
              <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white/80 backdrop-blur">{name}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Promises() {
  const items: [IconName, string, string][] = [
    ["shield", "Your work stays yours", "Wanlly never trains AI on your prompts, files or projects."],
    ["lock", "Sponsors see nothing", "Advertisers never see what you write or build. Ads are matched to the page, not to you."],
    ["check", "Honest about costs", "Every reply shows its model and what it cost. No surprise limits."],
  ];
  return (
    <section className="mx-auto grid max-w-[1180px] gap-4 px-4 py-24 sm:px-6 md:grid-cols-3">
      {items.map(([icon, t, d]) => (
        <div key={t} className="flex flex-col gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent">
            <Icon name={icon} size={17} />
          </span>
          <b className="mt-1 font-semibold">{t}</b>
          <p className="text-sm text-muted">{d}</p>
        </div>
      ))}
    </section>
  );
}

const FAQ = [
  ["Is it really free?", "Yes. You never enter a card. Each day, one short video unlocks your floor of credits, and sponsors pay for it. If you want more, you can watch more videos or try a sponsor's product."],
  ["Which AI models can I use?", "Claude (Haiku, Sonnet, Opus and Fable) and Gemini. You choose for every message. GPT, Grok and image models are coming."],
  ["Why the same floor everywhere?", "Ads pay very differently by country. A community pool, funded by higher-paying regions and sponsors, makes sure a student in Lagos gets the same start as one in London."],
  ["Who is it for?", "Students and creators with ideas and no budget for AI subscriptions: anyone who wants to build an app, a site, a shop page or a side project."],
  ["When can I start?", "We're letting people in weekly. Join the beta and invite friends to move up the list."],
];

function Faq() {
  return (
    <section className="border-t border-line">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
        <SectionHead eyebrow="Questions" title="Good questions, straight answers." />
        <div className="flex flex-col">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group border-b border-line py-4 first:border-t">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {q}
                <span className="text-faint transition-transform group-open:rotate-45">
                  <Icon name="plus" size={16} />
                </span>
              </summary>
              <p className="pt-2 text-sm text-muted">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-4 pb-24 sm:px-6">
      <div className="relative isolate mx-auto max-w-[1180px] overflow-hidden rounded-3xl bg-[#0b0c10] px-6 py-16 text-center text-white sm:py-20">
        <div aria-hidden="true" className="anim-aurora-a absolute -top-1/2 left-1/4 -z-10 h-[140%] w-[60%] rounded-full bg-[radial-gradient(closest-side,rgba(255,90,31,0.5),transparent)] blur-3xl" />
        <div aria-hidden="true" className="anim-aurora-b absolute -right-1/4 -bottom-1/2 -z-10 h-[140%] w-[50%] rounded-full bg-[radial-gradient(closest-side,rgba(124,92,255,0.4),transparent)] blur-3xl" />
        <h2 className="mx-auto max-w-[18ch] font-display text-[clamp(30px,4.4vw,52px)] leading-[1.02] font-semibold tracking-[-0.035em] text-balance">Build the thing you keep thinking about.</h2>
        <p className="mx-auto mt-4 max-w-[46ch] text-[15px] text-white/70">Join the beta today. We review every application and let new people in each week.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/beta" className="rounded-full bg-[#ff5a1f] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(255,90,31,0.45)] hover:bg-[#ff6a33]">
            Join the beta
          </Link>
          <Link href="/sign-in" className="rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium hover:bg-white/10">
            I have an invite
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Landing() {
  return (
    <>
      <Hero />
      <ModelStrip />
      <Features />
      <HowFree />
      <Worldwide />
      <Promises />
      <Faq />
      <FinalCta />
    </>
  );
}
