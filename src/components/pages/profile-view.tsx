"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useState, type ReactNode } from "react";
import { FLOOR_CREDITS, MODELS } from "@/lib/catalog";
import { useWorkspace } from "@/lib/workspace-store";
import { Icon, type IconName } from "../icon";
import { PageFrame, Panel, btnDark, btnGhost } from "./page-frame";

const SECTIONS = [
  ["profile", "Profile"],
  ["preferences", "Preferences"],
  ["credits", "Credits and standing"],
  ["ads", "Ads and privacy"],
  ["connections", "Connections"],
  ["notifications", "Notifications"],
  ["security", "Sign-in and security"],
  ["data", "Your data"],
] as const;

const input = "w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] outline-none focus:border-faint";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
      <span className="pt-2 text-[13px] font-medium">
        {label}
        {hint && <small className="block text-xs font-normal text-muted">{hint}</small>}
      </span>
      <div className="min-w-0">{children}</div>
    </label>
  );
}

function Switch({ label, detail, initial = false }: { label: string; detail?: string; initial?: boolean }) {
  const [on, setOn] = useState(initial);
  return (
    <div className="flex items-start gap-4 border-t border-line py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1 text-[13px]">
        <span className="font-medium">{label}</span>
        {detail && <small className="block text-xs text-muted">{detail}</small>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => setOn(!on)}
        className={`relative mt-0.5 h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-line"}`}
      >
        <i className={`absolute top-[3px] size-4 rounded-full bg-white shadow transition-[left] ${on ? "left-[19px]" : "left-[3px]"}`} />
      </button>
    </div>
  );
}

function Seg<T extends string>({ options, initial, label }: { options: T[]; initial: T; label: string }) {
  const [v, setV] = useState<T>(initial);
  return (
    <div className="inline-flex flex-wrap gap-0.5 rounded-[10px] bg-hover p-[3px]" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={v === o}
          onClick={() => setV(o)}
          className={`rounded-lg px-3 py-1 text-[13px] ${v === o ? "bg-surface font-medium text-fg shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Line({ icon, title, detail, children }: { icon: IconName; title: string; detail: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line py-3 first:border-t-0 first:pt-0">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-hover text-muted">
        <Icon name={icon} size={16} />
      </span>
      <div className="min-w-0 flex-1 basis-[200px] text-[13px]">
        <b className="block font-medium">{title}</b>
        <small className="block text-xs text-muted">{detail}</small>
      </div>
      {children}
    </div>
  );
}

const TOPICS = ["Learning and courses", "Developer tools", "Laptops and phones", "Jobs and internships", "Money and banking", "Design tools", "Games", "Travel"];

/** No account-age levels: every model is open from day one. Only the risk checks can limit an account. */
function Standing() {
  const checks = [
    ["Phone verified", "+254 7•• ••• 412"],
    ["Device recognised", "Chrome on Windows"],
    ["Human check passed", "Today"],
  ];
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-good/12 px-2 py-0.5 text-xs font-medium text-good">✓ Good standing</span>
        <span className="text-[13px]">Every model and tool is open to you: Haiku, Sonnet, Opus, Fable, Code and coworkers.</span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-3">
        {checks.map(([t, d]) => (
          <li key={t} className="flex flex-col rounded-lg bg-code px-3 py-2 text-xs">
            <b className="font-medium">✓ {t}</b>
            <span className="text-muted">{d}</span>
          </li>
        ))}
      </ul>
      <small className="text-xs text-muted">Accounts are only slowed down or paused if our checks spot abuse, and a person reviews every pause.</small>
    </div>
  );
}

export function ProfileView() {
  const { credits, floorUnlocked, dispatch } = useWorkspace();
  const { isSignedIn, user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [topics, setTopics] = useState<string[]>(["Learning and courses", "Developer tools", "Jobs and internships"]);
  const saved = () => dispatch({ type: "toast", text: "Saved" });

  return (
    <PageFrame title="Profile and settings" subtitle="Everything about your account, in one place. Changes save as you go.">
      <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto lg:sticky lg:top-0 lg:flex-col lg:self-start">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-lg px-2.5 py-1.5 text-[13px] whitespace-nowrap text-muted hover:bg-hover hover:text-fg">
              {label}
            </a>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Profile" className="scroll-mt-4" note="Shown on projects you share and in the public gallery, if you opt in.">
            <div id="profile" className="flex items-center gap-4">
              <span className="grid size-11 place-items-center rounded-full bg-fg font-display text-base font-semibold text-bg">L</span>
              <button type="button" className={btnGhost}>
                Change photo
              </button>
            </div>
            <Field label="Name">
              <input className={input} defaultValue="Louis" onBlur={saved} />
            </Field>
            <Field label="Username">
              <input className={input} defaultValue="louis" onBlur={saved} />
            </Field>
            <Field label="What you're building" hint="Helps Smart pick and templates suit you.">
              <textarea className={`${input} min-h-20 resize-y`} defaultValue="A free AI workspace for students and creators, paid for by ads." onBlur={saved} />
            </Field>
            <Field label="Country" hint="From your network. Sets ad rates, so it can't be edited.">
              <div className={`${input} flex items-center gap-2 bg-code text-muted`}>
                <Icon name="lock" size={14} /> Kenya
              </div>
            </Field>
            <Field label="Student" hint="Verify a university email for a bonus on your daily floor.">
              <div className="flex gap-2">
                <input className={input} placeholder="you@university.ac.ke" />
                <button type="button" className={btnGhost} onClick={() => dispatch({ type: "toast", text: "We sent a code to that address" })}>
                  Verify
                </button>
              </div>
            </Field>
          </Panel>

          <Panel title="Preferences">
            <div id="preferences" />
            <Field label="Default model" hint="Cheapest first. Smart pick suggests a bigger one when a task needs it.">
              <select className={input} defaultValue="haiku" onChange={saved}>
                {MODELS.filter((m) => m.group === "Anthropic").map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.credits} cr
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Start in">
              <Seg label="Start in" options={["Chat", "Code", "Design", "Images"]} initial="Chat" />
            </Field>
            <Field label="Theme">
              <Seg label="Theme" options={["System", "Light", "Dark"]} initial="System" />
            </Field>
            <div className="border-t border-line pt-3">
              <Switch label="Smart pick" detail="Suggest the cheapest model that will do the job well." initial />
              <Switch label="Ask before long jobs" detail="Show the cost check before any build that could use more than 80% of your credits." initial />
            </div>
          </Panel>

          <Panel title="Credits and standing" note="Credits are the only limit. Every one was paid for by an ad or the community pool.">
            <div id="credits" className="grid gap-3 sm:grid-cols-3">
              {[
                ["Balance", `${credits} credits`],
                ["Today's floor", floorUnlocked ? `Unlocked · ${FLOOR_CREDITS}` : "Locked"],
                ["Videos this week", "11"],
              ].map(([l, v]) => (
                <div key={l} className="flex flex-col gap-0.5 rounded-xl bg-code p-3">
                  <span className="text-[11px] font-medium tracking-[0.08em] text-faint uppercase">{l}</span>
                  <b className="font-display text-lg font-semibold">{v}</b>
                </div>
              ))}
            </div>
            <Standing />
            <button type="button" className={`${btnGhost} self-start`}>
              See every credit in and out
            </button>
          </Panel>

          <Panel title="Ads and privacy" note="Ads keep Wanlly free. You choose what they're about; sponsors never see your prompts or your work.">
            <div id="ads" className="flex flex-col gap-2">
              <span className="text-[13px] font-medium">Topics you&apos;d like ads about</span>
              <div className="flex flex-wrap gap-2">
                {TOPICS.map((t) => {
                  const on = topics.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setTopics(on ? topics.filter((x) => x !== t) : [...topics, t])}
                      className={`rounded-full border px-3 py-1 text-[13px] ${on ? "border-accent-line bg-accent-soft font-medium text-accent" : "border-line text-muted hover:border-faint"}`}
                    >
                      {on ? "✓ " : ""}
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
            <Field label="Extra videos go to">
              <Seg label="Extra videos go to" options={["My credits", "Community pool"]} initial="My credits" />
            </Field>
            <div className="border-t border-line pt-3">
              <Switch label="Personalised ads" detail="Use your topics and country to pick ads. Off means only ads matched to the page." initial />
              <Switch label="Sound on for videos" detail="Videos start muted unless you turn this on." />
            </div>
            <button type="button" className={`${btnGhost} self-start`}>
              Cookie settings
            </button>
          </Panel>

          <Panel title="Connections" note="Wanlly only sees what you allow, and you can disconnect anytime.">
            <div id="connections" className="flex flex-col">
              <Line icon="github" title="GitHub" detail="Connected · 2 repositories">
                <button type="button" className={btnGhost}>
                  Manage
                </button>
              </Line>
              <Line icon="link" title="Google Workspace" detail="Not connected · Docs, Sheets and Drive files you pick">
                <button type="button" className={btnDark}>
                  Connect
                </button>
              </Line>
              <Line icon="chat" title="Twilio" detail="Your key, encrypted · ending 3f9a · your own Twilio bill">
                <button type="button" className={btnGhost}>
                  Replace key
                </button>
              </Line>
            </div>
          </Panel>

          <Panel title="Notifications">
            <div id="notifications">
              <Switch label="A coworker needs your OK" detail="Email and push" initial />
              <Switch label="Your floor is ready each morning" detail="Push only" initial />
              <Switch label="Weekly summary" detail="What you built and what it cost" initial />
              <Switch label="Product news" detail="New models and features, about once a month" />
            </div>
          </Panel>

          <Panel title="Sign-in and security" note="Sign-in is handled by Clerk. Passwords, passkeys, connected Google or GitHub, and your devices are all managed there.">
            <div id="security" className="flex flex-col">
              <Line icon="shield" title={user?.primaryEmailAddress?.emailAddress ?? "Not signed in"} detail={isSignedIn ? `Signed in${user?.externalAccounts.length ? ` with ${user.externalAccounts.map((a) => a.provider.replace("oauth_", "")).join(" and ")}` : ""}` : "Sign in to manage your account"}>
                {isSignedIn ? (
                  <button type="button" className={btnGhost} onClick={() => openUserProfile()}>
                    Manage sign-in and devices
                  </button>
                ) : (
                  <a href="/sign-in" className={btnDark}>
                    Sign in
                  </a>
                )}
              </Line>
            </div>
            {isSignedIn && (
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnDark} onClick={() => signOut({ redirectUrl: "/sign-in" })}>
                  <Icon name="logout" size={15} /> Sign out
                </button>
              </div>
            )}
          </Panel>

          <Panel title="Your data" note="Wanlly never trains AI on your prompts, files or projects.">
            <div id="data" className="flex flex-col">
              <Line icon="clip" title="Download my data" detail="Everything we hold about you, as a zip, within a day">
                <button type="button" className={btnGhost}>
                  Request download
                </button>
              </Line>
              <Line icon="clock" title="How long we keep things" detail="Chats 90 days unless saved in a project · security logs 12 months" />
              <Line icon="x" title="Delete my account" detail="Removes your projects, chats and credits within 30 days. This can't be undone.">
                <button type="button" className="inline-flex items-center rounded-[10px] border border-bad/40 px-3.5 py-2 text-[13px] font-medium text-bad">
                  Delete account
                </button>
              </Line>
            </div>
          </Panel>
        </div>
      </div>
    </PageFrame>
  );
}
