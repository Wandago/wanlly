"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useRef, useState, type ReactNode } from "react";
import { FLOOR_CREDITS, MODELS, WEEKLY_SPEND_LIMIT_VERIFIED } from "@/lib/catalog";
import { AD_TOPICS, applyTheme, type Settings, type Theme } from "@/lib/settings";
import { useWorkspace } from "@/lib/workspace-store";
import { Icon, type IconName } from "../icon";
import { UsageMeters } from "../usage-meters";
import { PageFrame, Panel, btnDark, btnGhost, chip } from "./page-frame";
import { SpinLoader } from "../spin-mark";
import { openPhoneVerify } from "../phone-verify";

const SECTIONS = [
  ["profile", "Profile"],
  ["preferences", "Preferences"],
  ["credits", "Credits and limits"],
  ["ads", "Ads and privacy"],
  ["connections", "Connections"],
  ["notifications", "Notifications"],
  ["security", "Sign-in and security"],
  ["data", "Your data"],
] as const;

const input = "w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] outline-none focus:border-faint";
const LIVE_MODELS = MODELS.filter((m) => m.id !== "gpt" && m.id !== "grok");
const TOOL_LABELS = { chat: "Chat", code: "Code", design: "Design", images: "Images" } as const;
const THEME_LABELS: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };

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

function Switch({ label, detail, on, onChange }: { label: string; detail?: string; on: boolean; onChange: (on: boolean) => void }) {
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
        onClick={() => onChange(!on)}
        className={`relative mt-0.5 h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-line"}`}
      >
        <i className={`absolute top-[3px] size-4 rounded-full bg-white shadow transition-[left] ${on ? "left-[19px]" : "left-[3px]"}`} />
      </button>
    </div>
  );
}

function Seg<T extends string>({ options, value, onChange, label }: { options: Record<T, string>; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="inline-flex flex-wrap gap-0.5 rounded-[10px] bg-hover p-[3px]" role="group" aria-label={label}>
      {(Object.keys(options) as T[]).map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={value === o}
          onClick={() => onChange(o)}
          className={`rounded-lg px-3 py-1 text-[13px] ${value === o ? "bg-surface font-medium text-fg shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted"}`}
        >
          {options[o]}
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

const Soon = () => <span className={chip}>Soon</span>;

/** Saves settings as they change: the page updates at once and the server confirms. */
function useSettings() {
  const { settings, dispatch } = useWorkspace();
  const save = async (patch: Partial<Settings>) => {
    if (!settings) return;
    const before = settings;
    dispatch({ type: "settings", settings: { ...settings, ...patch } });
    try {
      const r = await fetch("/api/me/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
      if (!r.ok) throw new Error(String(r.status));
      dispatch({ type: "settings", settings: await r.json() });
      dispatch({ type: "toast", text: "Saved" });
    } catch {
      dispatch({ type: "settings", settings: before });
      dispatch({ type: "toast", text: "Couldn't save that. Try again" });
    }
  };
  return { settings, save };
}

/** What Wanlly remembers about you: see it, correct it, switch it off, or wipe it. */
function MemoryPanel() {
  const { memory, dispatch } = useWorkspace();
  const { settings: s, save } = useSettings();
  const [about, setAbout] = useState<string | null>(null);
  const [interests, setInterests] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shownAbout = about ?? memory?.about ?? "";
  const shownInterests = interests ?? memory?.interests.join(", ") ?? "";
  const dirty = about !== null || interests !== null;
  const put = async (body: object | null) => {
    setBusy(true);
    try {
      const r = await fetch("/api/me/memory", body ? { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { method: "DELETE" });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? "Couldn't save that");
      dispatch({ type: "memory", memory: b.memory ?? null });
      setAbout(null);
      setInterests(null);
      dispatch({ type: "toast", text: body ? "Saved" : "Forgotten" });
    } catch (e) {
      dispatch({ type: "toast", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title="What Wanlly remembers" note="A short profile Wanlly writes from your chats, so answers fit you and the home screen suggests useful next steps. It never keeps health, money, religion or politics details, passwords, or anything about other people. Sponsors never see it.">
      <div id="memory" className="flex flex-col gap-3">
        {s && <Switch label="Remember things about me" detail="Off: nothing new is kept and replies don't use what's here." on={s.memory} onChange={(v) => save({ memory: v })} />}
        {memory || dirty ? (
          <>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              About you
              <textarea rows={4} value={shownAbout} onChange={(e) => setAbout(e.target.value)} className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-normal outline-none focus:border-faint" />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Interests <span className="font-normal text-faint">comma separated</span>
              <input value={shownInterests} onChange={(e) => setInterests(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-normal outline-none focus:border-faint" />
            </label>
            {memory?.suggestions.length ? <p className="text-xs text-muted">Suggested next: {memory.suggestions.join(" · ")}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!dirty || busy}
                onClick={() => put({ about: shownAbout, interests: shownInterests.split(",").map((x) => x.trim()).filter(Boolean), suggestions: memory?.suggestions ?? [] })}
                className="rounded-[10px] bg-fg px-3.5 py-2 text-[13px] font-semibold text-bg disabled:opacity-50"
              >
                Save changes
              </button>
              <button type="button" disabled={busy || !memory} onClick={() => window.confirm("Forget everything Wanlly remembers about you?") && put(null)} className="rounded-[10px] border border-line px-3.5 py-2 text-[13px] font-medium hover:border-faint disabled:opacity-50">
                Forget everything
              </button>
            </div>
          </>
        ) : (
          <p className="text-[13px] text-muted">Nothing yet. After a few chats, what Wanlly learns about you shows here, and you can change it anytime.</p>
        )}
      </div>
    </Panel>
  );
}

function countryName(code: string | null | undefined) {
  if (!code || code === "XX" || code === "T1") return "Unknown";
  try {
    return new Intl.DisplayNames(undefined, { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

const STANDING: Record<string, [string, string]> = {
  active: ["bg-good/12 text-good", "✓ Good standing"],
  slowed: ["bg-hover text-muted", "Slowed down for now"],
  challenged: ["bg-hover text-muted", "Please complete a check"],
  frozen: ["bg-bad/12 text-bad", "Paused while we review"],
  banned: ["bg-bad/12 text-bad", "Closed"],
};

/** No account-age levels: every model is open from day one. Only the risk checks can limit an account. */
function Standing() {
  const { me } = useWorkspace();
  const { user } = useUser();
  const [cls, label] = STANDING[me?.status ?? "active"] ?? STANDING.active;
  const email = user?.primaryEmailAddress;
  const phone = user?.phoneNumbers.find((p) => p.verification?.status === "verified");
  const providers = user?.externalAccounts.map((a) => a.provider.replace("oauth_", "")) ?? [];
  const checks: [boolean, string, string][] = [
    [email?.verification?.status === "verified", "Email verified", email?.emailAddress ?? "–"],
    [Boolean(phone), "Phone verified", phone ? `•••• ${phone.phoneNumber.slice(-3)}` : "Not added yet"],
    [providers.length > 0, "Connected sign-in", providers.length ? providers.map((p) => p[0].toUpperCase() + p.slice(1)).join(" and ") : "Email only"],
  ];
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
        <span className="text-[13px]">Every model and tool is open to you. Credits and the usage limits are the only limits.</span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-3">
        {checks.map(([ok, t, d]) => (
          <li key={t} className="flex flex-col rounded-lg bg-code px-3 py-2 text-xs">
            <b className={`font-medium ${ok ? "" : "text-muted"}`}>
              {ok ? "✓" : "○"} {t}
            </b>
            <span className="truncate text-muted">{d}</span>
          </li>
        ))}
      </ul>
      <small className="text-xs text-muted">Accounts are only slowed down or paused if our checks spot abuse, and a person reviews every pause.</small>
    </div>
  );
}

type Entry = { delta: number; reason: string; note: string | null; at: string };
const REASONS: Record<string, string> = { floor: "First ad today", video: "Sponsor ad", settle: "Used", admin_grant: "From Wanlly", reversal: "Reversed", referral: "Referral", student_bonus: "Student bonus" };

function History() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [state, setState] = useState<"closed" | "loading" | "open" | "error">("closed");
  const load = async () => {
    if (state === "open") return setState("closed");
    setState("loading");
    try {
      const r = await fetch("/api/me/ledger", { cache: "no-store" });
      if (!r.ok) throw new Error();
      setEntries((await r.json()).entries);
      setState("open");
    } catch {
      setState("error");
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <button type="button" className={`${btnGhost} self-start`} onClick={load} aria-expanded={state === "open"}>
        {state === "open" ? "Hide history" : state === "loading" ? "Loading…" : "See every credit in and out"}
      </button>
      {state === "error" && <p className="text-[13px] text-bad">Couldn&apos;t load your history. Try again.</p>}
      {state === "open" && entries && (
        <div className="max-h-[280px] overflow-y-auto rounded-xl border border-line">
          {entries.length === 0 ? (
            <p className="p-3 text-[13px] text-muted">Nothing yet. Watch an ad to earn your first credits.</p>
          ) : (
            <table className="w-full text-[13px]">
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i} className="border-t border-line first:border-t-0">
                    <td className="px-3 py-2">
                      {REASONS[e.reason] ?? e.reason}
                      {e.note && e.reason === "settle" && <small className="block text-xs text-muted">{e.note}</small>}
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-muted">{new Date(e.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                    <td className={`px-3 py-2 text-right font-mono tabular-nums ${e.delta > 0 ? "text-good" : ""}`}>
                      {e.delta > 0 ? `+${e.delta}` : e.delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function ProfilePanel() {
  const { me, dispatch } = useWorkspace();
  const { settings, save } = useSettings();
  const { user } = useUser();
  const file = useRef<HTMLInputElement>(null);
  const toast = (text: string) => dispatch({ type: "toast", text });

  const saveName = async (full: string) => {
    if (!user || !full.trim() || full.trim() === user.fullName) return;
    const [firstName, ...rest] = full.trim().split(/\s+/);
    try {
      await user.update({ firstName, lastName: rest.join(" ") });
      toast("Saved");
    } catch {
      toast("Couldn't save your name. Try again");
    }
  };
  const savePhoto = async (f: File | undefined) => {
    if (!user || !f) return;
    if (f.size > 5 * 1024 * 1024) return toast("Pick a photo under 5 MB");
    try {
      await user.setProfileImage({ file: f });
      toast("Photo updated");
    } catch {
      toast("Couldn't upload that photo. Try a JPG or PNG");
    }
  };

  return (
    <Panel title="Profile" note="Your name and photo come from your sign-in, and show on projects you share.">
      <div id="profile" className="flex scroll-mt-4 items-center gap-4">
        {user?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.imageUrl} alt="" className="size-11 rounded-full object-cover" />
        ) : (
          <span className="grid size-11 place-items-center rounded-full bg-fg font-display text-base font-semibold text-bg">{user?.firstName?.[0] ?? "·"}</span>
        )}
        <button type="button" className={btnGhost} onClick={() => file.current?.click()} disabled={!user}>
          Change photo
        </button>
        <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => savePhoto(e.target.files?.[0])} />
      </div>
      <Field label="Name">
        <input key={user?.fullName ?? ""} className={input} defaultValue={user?.fullName ?? ""} maxLength={80} onBlur={(e) => saveName(e.target.value)} />
      </Field>
      <Field label="Email" hint="Change it in Sign-in and security.">
        <div className={`${input} truncate bg-code text-muted`}>{user?.primaryEmailAddress?.emailAddress ?? "–"}</div>
      </Field>
      <Field label="What you're building" hint="Helps us suggest models and templates that suit you.">
        <textarea
          key={settings ? "loaded" : "loading"}
          className={`${input} min-h-20 resize-y`}
          defaultValue={settings?.building ?? ""}
          maxLength={500}
          placeholder="A study app for my class, a shop website, my first game…"
          disabled={!settings}
          onBlur={(e) => e.target.value.trim() !== settings?.building && save({ building: e.target.value })}
        />
      </Field>
      <Field label="Country" hint="From your network, set on your first visit. It can't be edited.">
        <div className={`${input} flex items-center gap-2 bg-code text-muted`}>
          <Icon name="lock" size={14} /> {countryName(me?.country)}
        </div>
      </Field>
      <Field label="Student" hint="Verify a university email for bonus credits.">
        <div className="flex items-center gap-2">
          <input className={input} placeholder="you@university.edu" disabled />
          <Soon />
        </div>
      </Field>
    </Panel>
  );
}

function DataPanel() {
  const { dispatch } = useWorkspace();
  const { signOut } = useClerk();
  const [deleting, setDeleting] = useState(false);
  const remove = async () => {
    if (!window.confirm("Delete your Wanlly account? Your projects and credits go, and this can't be undone.")) return;
    setDeleting(true);
    const r = await fetch("/api/me", { method: "DELETE" }).catch(() => null);
    if (r?.ok) return signOut({ redirectUrl: "/" });
    setDeleting(false);
    dispatch({ type: "toast", text: "Couldn't delete your account just now. Try again" });
  };
  return (
    <Panel title="Your data" note="Wanlly never trains AI on your prompts, files or projects.">
      <div id="data" className="flex flex-col">
        <Line icon="clip" title="Download my data" detail="Your account, settings, projects and every credit in and out, as one file">
          <a href="/api/me/export" download className={btnGhost}>
            Download
          </a>
        </Line>
        <Line icon="clock" title="How long we keep things" detail="Chats 90 days unless saved in a project · deleted projects 30 days · security logs 12 months" />
        <Line icon="x" title="Delete my account" detail="Removes your sign-in, projects and credits. This can't be undone.">
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="inline-flex items-center rounded-[10px] border border-bad/40 px-3.5 py-2 text-[13px] font-medium text-bad disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete account"}
          </button>
        </Line>
      </div>
    </Panel>
  );
}

export function ProfileView() {
  const { credits, floorUnlocked, usage, synced } = useWorkspace();
  const { settings, save } = useSettings();
  const { isSignedIn, user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const s = settings;
  const providers = user?.externalAccounts.map((a) => a.provider.replace("oauth_", "")) ?? [];

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
          <ProfilePanel />

          <Panel title="Preferences">
            <div id="preferences" />
            {s ? (
              <>
                <Field label="Default model" hint="What new chats start on. Cheapest first.">
                  <select className={input} value={s.defaultModel} onChange={(e) => save({ defaultModel: e.target.value })}>
                    {LIVE_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} · {m.credits} cr
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Start in">
                  <Seg label="Start in" options={TOOL_LABELS} value={s.startIn} onChange={(v) => save({ startIn: v })} />
                </Field>
                <Field label="Theme">
                  <Seg
                    label="Theme"
                    options={THEME_LABELS}
                    value={s.theme}
                    onChange={(v) => {
                      applyTheme(v);
                      save({ theme: v });
                    }}
                  />
                </Field>
                <div className="border-t border-line pt-3">
                  <Switch label="Smart pick" detail="Suggest the cheapest model that will do the job well." on={s.smartPick} onChange={(v) => save({ smartPick: v })} />
                  <Switch
                    label="Ask before long jobs"
                    detail="Show the cost before any job that could use more than 80% of your credits."
                    on={s.askBeforeLong}
                    onChange={(v) => save({ askBeforeLong: v })}
                  />
                </div>
              </>
            ) : (
              <SpinLoader size={28} label="Loading your preferences" />
            )}
          </Panel>

          <Panel title="Credits and limits" note="Every credit was paid for by a sponsor. Limits are the same for everyone and keep Wanlly free for all.">
            <div id="credits" className="grid gap-3 sm:grid-cols-3">
              {[
                ["Balance", synced ? `${credits} credits` : "–"],
                ["Today's bonus", floorUnlocked ? `Collected · +${FLOOR_CREDITS}` : `+${FLOOR_CREDITS} waiting`],
                ["Ads today", usage ? `${usage.videos} of ${usage.videoCap}` : "–"],
              ].map(([l, v]) => (
                <div key={l} className="flex flex-col gap-0.5 rounded-xl bg-code p-3">
                  <span className="text-[11px] font-medium tracking-[0.08em] text-faint uppercase">{l}</span>
                  <b className="font-display text-lg font-semibold">{v}</b>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-line p-3.5">
              <UsageMeters usage={usage} />
              {usage && (
                <p className="mt-2.5 text-xs text-muted">
                  You can use up to {usage.dayLimit} credits in a 6-hour session and {usage.weekLimit} a week, however many you&apos;ve saved. Both start with your first request.
                </p>
              )}
              {usage && !usage.verified && (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                  Building something big? Verify your number on WhatsApp and your weekly limit goes up to {WEEKLY_SPEND_LIMIT_VERIFIED}.
                  <button type="button" onClick={openPhoneVerify} className="font-medium text-fg underline-offset-2 hover:underline">
                    Verify now
                  </button>
                </p>
              )}
            </div>
            <Standing />
            <History />
          </Panel>

          <MemoryPanel />

          <Panel title="Ads and privacy" note="Ads keep Wanlly free. You choose what they're about; sponsors never see your prompts or your work.">
            <div id="ads" className="flex flex-col gap-2">
              <span className="text-[13px] font-medium">Topics you&apos;d like ads about</span>
              <div className="flex flex-wrap gap-2">
                {AD_TOPICS.map((t) => {
                  const on = s?.adTopics.includes(t) ?? false;
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={on}
                      disabled={!s}
                      onClick={() => s && save({ adTopics: on ? s.adTopics.filter((x) => x !== t) : [...s.adTopics, t] })}
                      className={`rounded-full border px-3 py-1 text-[13px] ${on ? "border-accent-line bg-accent-soft font-medium text-accent" : "border-line text-muted hover:border-faint"}`}
                    >
                      {on ? "✓ " : ""}
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
            {s && (
              <div className="border-t border-line pt-3">
                <Switch
                  label="Personalised ads"
                  detail="Use your topics and country to pick ads. Off means only ads matched to the page."
                  on={s.personalisedAds}
                  onChange={(v) => save({ personalisedAds: v })}
                />
                <Switch label="Sound on for ads" detail="Ads start muted unless you turn this on." on={s.videoSound} onChange={(v) => save({ videoSound: v })} />
              </div>
            )}
          </Panel>

          <Panel title="Connections" note="Wanlly only sees what you allow, and you can disconnect anytime.">
            <div id="connections" className="flex flex-col">
              <Line icon="github" title="GitHub" detail={providers.includes("github") ? "You sign in with GitHub. Repository access arrives with Code" : "Repository access arrives with Code"}>
                <Soon />
              </Line>
              <Line icon="link" title="Google Workspace" detail="Docs, Sheets and Drive files you pick">
                <Soon />
              </Line>
              <Line icon="chat" title="Twilio" detail="Your own key and bill, for SMS from your apps">
                <Soon />
              </Line>
            </div>
          </Panel>

          <Panel title="Notifications" note="Saved now. Emails and push start when notifications launch.">
            <div id="notifications">
              {s &&
                (
                  [
                    ["coworkerNeedsOk", "A coworker needs your OK", "Email and push"],
                    ["bonusReady", "Your daily bonus is ready", "Push only"],
                    ["weeklySummary", "Weekly summary", "What you built and what it cost"],
                    ["productNews", "Product news", "New models and features, about once a month"],
                  ] as const
                ).map(([k, label, detail]) => (
                  <Switch key={k} label={label} detail={detail} on={s.notify[k]} onChange={(v) => save({ notify: { ...s.notify, [k]: v } })} />
                ))}
            </div>
          </Panel>

          <Panel title="Sign-in and security" note="Sign-in is handled by Clerk. Passwords, passkeys, connected Google or GitHub, and your devices are all managed there.">
            <div id="security" className="flex flex-col">
              <Line
                icon="shield"
                title={user?.primaryEmailAddress?.emailAddress ?? "Not signed in"}
                detail={isSignedIn ? `Signed in${providers.length ? ` with ${providers.join(" and ")}` : ""}` : "Sign in to manage your account"}
              >
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

          <DataPanel />
        </div>
      </div>
    </PageFrame>
  );
}
