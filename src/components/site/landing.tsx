import Link from "next/link";
import { ClaudeMark, GeminiMark } from "./brand-marks";
import type { ReactNode } from "react";
import { FLOOR_CREDITS } from "@/lib/catalog";
import { Icon, type IconName } from "../icon";
import { SpinLoader } from "../spin-mark";

/* The public home page. Flat and typographic: solid colours, hairline borders, no gradients or glows. */

/** The "Runs on" strip: each maker once, with its mark when Wanlly runs its models. */
const MAKERS: { maker: string; mark?: ReactNode; models: string[]; live: boolean }[] = [
  { maker: "Claude", mark: <ClaudeMark />, models: ["Haiku 5.5", "Sonnet 5.5", "Opus 5.5"], live: true },
  { maker: "Gemini", mark: <GeminiMark />, models: ["Flash"], live: true },
  // Open models via NVIDIA: switch to live once NVIDIA_API_KEY is set and Admin's model check passes.
  { maker: "DeepSeek", models: ["V4 Flash", "V4 Pro"], live: false },
  { maker: "Z.ai", models: ["GLM 5.3", "GLM 5.3 Flash"], live: false },
  { maker: "Moonshot", models: ["Kimi K3"], live: false },
  { maker: "OpenAI", models: ["GPT"], live: false },
  { maker: "xAI", models: ["Grok 4.3", "Grok 4.7"], live: false },
];

function Hero() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto grid max-w-[1180px] items-center gap-12 px-4 pt-16 pb-16 sm:px-6 sm:pt-24 lg:grid-cols-[1fr_1.05fr] lg:pb-24">
        <div className="flex flex-col items-start gap-6">
          <Link href="/beta" className="anim-rise inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted hover:border-faint hover:text-fg">
            <span className="size-1.5 rounded-full bg-accent" />
            Private beta, opening in weekly groups
            <span aria-hidden="true">→</span>
          </Link>
          <h1 className="anim-rise font-display text-[clamp(40px,5.6vw,68px)] leading-[1] font-semibold tracking-[-0.045em] text-balance [animation-delay:60ms]">
            Frontier AI for everyone with an idea<span className="text-accent">.</span>
          </h1>
          <p className="anim-rise max-w-[50ch] text-[clamp(15px,1.4vw,17px)] text-muted [animation-delay:120ms]">
            Chat, code and design with Claude and Gemini. No card and no subscription: watch short sponsor videos, earn credits, and build.
          </p>
          <div className="anim-rise flex flex-wrap gap-3 [animation-delay:180ms]">
            <Link href="/beta" className="rounded-lg bg-fg px-4 py-2.5 text-sm font-semibold text-bg hover:opacity-90">
              Join the beta
            </Link>
            <Link href="/#how" className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium hover:border-faint">
              How it&apos;s free
            </Link>
          </div>
          <dl className="anim-rise mt-2 grid w-full max-w-[460px] grid-cols-3 border-t border-line pt-5 [animation-delay:240ms]">
            {[
              ["20s", "per video"],
              ["0", "cards needed"],
              ["5", "frontier models"],
            ].map(([n, l]) => (
              <div key={l} className="flex flex-col">
                <dt className="order-2 text-xs text-muted">{l}</dt>
                <dd className="font-display text-2xl font-semibold tracking-[-0.02em] tabular-nums">{n}</dd>
              </div>
            ))}
          </dl>
        </div>
        <ProductPreview />
      </div>
    </section>
  );
}

/** A still of the app, drawn with real markup so it stays sharp. */
function ProductPreview() {
  return (
    <div className="anim-rise w-full [animation-delay:200ms]">
      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgb(20_24_35/0.04),0_24px_48px_-24px_rgb(20_24_35/0.18)]">
        <div className="flex items-center gap-1.5 border-b border-line bg-side px-3 py-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-2.5 rounded-full bg-line" />
          ))}
          <span className="ml-3 rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-[10px] text-faint">Wanlly</span>
        </div>
        <div className="grid text-left sm:grid-cols-[150px_minmax(0,1fr)]">
          <aside className="hidden flex-col gap-0.5 border-r border-line bg-side p-2.5 text-xs sm:flex">
            {(["chat", "code", "design", "folder", "users"] as IconName[]).map((ic, i) => (
              <span key={ic} className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${i === 1 ? "bg-hover font-medium text-fg" : "text-muted"}`}>
                <Icon name={ic} size={13} />
                {["Chat", "Code", "Design", "Projects", "Coworkers"][i]}
              </span>
            ))}
            <div className="mt-auto flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-2">
              <div className="flex justify-between text-[10px] text-muted">
                <span>Credits</span>
                <b className="font-mono text-fg">{FLOOR_CREDITS}</b>
              </div>
              <div className="h-1 rounded-full bg-hover">
                <i className="block h-full w-full rounded-full bg-accent" />
              </div>
            </div>
          </aside>
          <div className="flex min-w-0 flex-col gap-3 p-4">
            <div className="max-w-[85%] self-end rounded-[12px_12px_4px_12px] bg-hover px-3 py-2 text-[13px]">Build a booking page for my cousin&apos;s salon</div>
            <ol className="flex flex-col rounded-lg border border-line text-xs">
              {[
                ["Read the project", "14 files", true],
                ["Wrote the booking form", "+86 −4", true],
                ["Running tests", "31 of 31", false],
              ].map(([t, d, done]) => (
                <li key={t as string} className="flex items-center gap-2.5 border-t border-line px-3 py-2 first:border-t-0">
                  {done ? (
                    <span className="grid size-4 place-items-center rounded-full bg-fg text-bg">
                      <Icon name="check" size={10} />
                    </span>
                  ) : (
                    <SpinLoader size={16} label="" className="text-accent" />
                  )}
                  <span className="flex-1">{t}</span>
                  <span className="font-mono text-[10px] text-faint">{d}</span>
                </li>
              ))}
            </ol>
            <div className="flex items-center gap-2.5 rounded-lg border border-line p-2.5 text-xs">
              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[#2747d8] text-[11px] font-bold text-white">R</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[9px] tracking-[0.07em] text-faint uppercase">While you wait · Sponsored</span>
                <span className="block truncate">Railhouse · put this page online for free</span>
              </span>
              <span className="flex items-center gap-1 rounded-md bg-fg px-2 py-1 text-[11px] font-semibold text-bg">
                <Icon name="play" size={10} /> 20s <span className="text-accent">+4</span>
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-line p-2 pl-3 text-[13px]">
              <span className="flex-1 text-faint">Describe a change…</span>
              <span className="rounded-full bg-hover px-2 py-0.5 font-mono text-[10px] text-muted">Gemini Flash · 1 cr</span>
              <span className="grid size-7 place-items-center rounded-full bg-fg text-bg">
                <Icon name="up" size={14} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModelStrip() {
  return (
    <section aria-label="Models" className="border-b border-line">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-8 gap-y-3 px-4 py-6 sm:px-6">
        <span className="text-[11px] font-medium tracking-[0.08em] text-faint uppercase">Runs on</span>
        {MAKERS.map(({ maker, mark, models, live }) => (
          <span key={maker} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {mark ?? <span className="text-faint">{maker}</span>}
            {mark && <span className="text-muted">{maker}</span>}
            {models.map((m, i) => (
              <span key={m} className="flex items-baseline gap-2">
                {i > 0 && <span className="text-faint">·</span>}
                <b className={`font-display font-semibold ${live ? "" : "text-faint"}`}>{m}</b>
              </span>
            ))}
            {!live && <span className="text-[10px] text-faint">soon</span>}
          </span>
        ))}
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title, text }: { eyebrow: string; title: ReactNode; text?: string }) {
  return (
    <div className="flex max-w-[620px] flex-col gap-3">
      <span className="text-xs font-medium tracking-[0.08em] text-accent uppercase">{eyebrow}</span>
      <h2 className="font-display text-[clamp(28px,3.4vw,40px)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">{title}</h2>
      {text && <p className="text-[15px] text-muted">{text}</p>}
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
        <span className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5">
          <span className="text-accent">✦</span> <b className="font-medium">This one deserves Sonnet.</b> <span className="text-muted">About 6 credits.</span>
        </span>
      </div>
    ),
  },
  {
    icon: "code",
    title: "Code",
    text: "Describe an app, a tool or a fix. Wanlly writes the code, runs it in a live preview, and packs it up for you to download.",
    visual: (
      <div className="flex flex-col gap-1 font-mono text-[11px]">
        <span className="text-good">+ export async function debit()</span>
        <span className="text-bad">- // TODO: track usage</span>
        <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-md bg-fg px-2 py-1 text-bg">
          ▶ Run preview
        </span>
      </div>
    ),
  },
  {
    icon: "design",
    title: "Design",
    text: "Describe a page or a screen and watch it appear. Keep refining it in plain words.",
    visual: (
      <div className="mx-auto flex h-[92px] w-[52px] flex-col gap-1 rounded-[10px] border-[3px] border-fg bg-surface p-1.5">
        <i className="h-1 w-6 rounded bg-fg" />
        <i className="h-5 rounded bg-accent" />
        <i className="mt-auto h-2 rounded bg-fg" />
      </div>
    ),
  },
  {
    icon: "folder",
    title: "Projects",
    text: "Keep chats, files and instructions together for each thing you build.",
    visual: (
      <div className="grid grid-cols-3 gap-1.5">
        {["Salon app", "Farm prices", "Portfolio"].map((t) => (
          <span key={t} className="truncate rounded-md border border-line px-2 py-2 text-[10px] text-muted">
            {t}
          </span>
        ))}
      </div>
    ),
  },
  {
    icon: "users",
    title: "Coworkers",
    text: "Coming soon: AI teammates that test your app, draft posts or research on a schedule. They always ask before anything goes out.",
    visual: (
      <div className="flex flex-col gap-1.5 text-[11px]">
        {[
          ["T", "#2a78d6", "Tess · testing bookings"],
          ["R", "#c2410c", "Rafi · needs your OK"],
        ].map(([l, c, t]) => (
          <span key={t} className="flex w-fit items-center gap-1.5 rounded-full border border-line py-1 pr-2.5 pl-1">
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
      <SectionHead eyebrow="Product" title="Everything you need to go from idea to launch." text="One workspace for chatting, coding and designing, with the same models used by top labs and startups." />
      <div className="grid gap-4 md:grid-cols-3">
        {FEATURES.map((f) => (
          <article key={f.title} className={`flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 transition-colors hover:border-faint ${f.span ?? ""}`}>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg border border-line text-fg">
                <Icon name={f.icon} size={16} />
              </span>
              <h3 className="font-display text-base font-semibold">{f.title}</h3>
            </div>
            <p className="text-sm text-muted">{f.text}</p>
            <div className="mt-auto rounded-lg border border-line bg-bg p-3">{f.visual}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function HowFree() {
  const steps = [
    ["Watch short videos", "Each sponsor video is about 20 seconds and earns you credits. Watch more whenever you need more."],
    ["Build on any model", "Spend credits on Claude or Gemini. Bigger models use them faster, and you always see the cost first."],
    ["Other ways to earn", "Short surveys and trying a sponsor's product add credits too. Nothing is ever charged to a card."],
  ];
  return (
    <section id="how" className="scroll-mt-20 border-y border-line bg-side">
      <div className="mx-auto grid max-w-[1180px] gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
        <SectionHead
          eyebrow="How it's free"
          title="Sponsors pay. You build."
          text="Brands pay to meet curious, ambitious people. When you choose to watch, they pay for your AI. Ads sit beside your work, never inside an answer, and never change what a model says."
        />
        <ol className="flex flex-col">
          {steps.map(([t, d], i) => (
            <li key={t} className="flex gap-4 border-t border-line py-5 first:border-t-0 first:pt-0">
              <span className="font-mono text-sm text-accent">0{i + 1}</span>
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

const CITIES = ["Kenya", "Nigeria", "Ghana", "South Africa", "India", "Bangladesh", "Philippines", "Brazil", "And more"];

function Everywhere() {
  return (
    <section className="bg-fg text-bg">
      <div className="mx-auto grid max-w-[1180px] items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <span className="text-xs font-medium tracking-[0.08em] text-accent uppercase">For students and creators everywhere</span>
          <h2 className="font-display text-[clamp(28px,3.4vw,40px)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">Built for students and creators everywhere.</h2>
          <p className="max-w-[50ch] text-[15px] opacity-70">Starting with the people the best AI tools priced out. If you have an idea and an internet connection, Wanlly is for you.</p>
        </div>
        <ul className="grid grid-cols-2 border-t border-l border-bg/15 sm:grid-cols-3">
          {CITIES.map((c) => (
            <li key={c} className="flex flex-col gap-1 border-r border-b border-bg/15 p-4">
              <span className="text-xs opacity-60">{c}</span>
              <span className="font-display text-base font-semibold">Available</span>
            </li>
          ))}
        </ul>
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
    <section className="mx-auto grid max-w-[1180px] gap-10 px-4 py-24 sm:px-6 md:grid-cols-3">
      {items.map(([icon, t, d]) => (
        <div key={t} className="flex flex-col gap-2">
          <Icon name={icon} size={20} className="text-accent" />
          <b className="mt-1 font-semibold">{t}</b>
          <p className="text-sm text-muted">{d}</p>
        </div>
      ))}
    </section>
  );
}

const FAQ = [
  ["Is it really free?", "Yes. You never enter a card. You watch short sponsor videos and earn credits, and the sponsors pay for your AI. Need more? Watch a few more."],
  ["Which AI models can I use?", "Claude (Haiku, Sonnet and Opus), Gemini, Grok, DeepSeek, and open models like GLM and Kimi. You choose for every message. Fable 5.1, GPT and image models are coming."],
  ["How do credits work?", "Every video you watch adds credits to your balance. Each message or build uses some, and you always see how many before you send."],
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
    <section className="border-t border-line">
      <div className="mx-auto flex max-w-[1180px] flex-col items-start justify-between gap-6 px-4 py-20 sm:px-6 md:flex-row md:items-center">
        <h2 className="max-w-[20ch] font-display text-[clamp(28px,3.6vw,44px)] leading-[1.02] font-semibold tracking-[-0.035em] text-balance">Build the thing you keep thinking about.</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/beta" className="rounded-lg bg-fg px-4 py-2.5 text-sm font-semibold text-bg hover:opacity-90">
            Join the beta
          </Link>
          <Link href="/sign-in" className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium hover:border-faint">
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
      <Everywhere />
      <Promises />
      <Faq />
      <FinalCta />
    </>
  );
}
