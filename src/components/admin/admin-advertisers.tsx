"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState, type ReactNode } from "react";
import type { CoverKind } from "@/lib/catalog";
import { Cover } from "../ads/cover";
import { resetSeen, seenToday } from "@/lib/ad-track";
import { CountryPicker } from "./country-picker";
import { Icon } from "../icon";
import { Card, Chip, Empty, Pills, Table, api, btnDark, btnGhost, num, pct, usd, when } from "./admin-ui";

/* Advertisers: applications from /advertise, and the campaigns that run in Wanlly's ad slots. */

type Application = {
  id: number;
  company: string;
  contactName: string;
  email: string;
  website: string | null;
  country: string | null;
  category: string;
  budget: string | null;
  formats: string[];
  message: string;
  status: "pending" | "approved" | "declined";
  createdAt: string;
};

type Campaign = {
  id: number;
  applicationId: number | null;
  advertiser: string;
  name: string;
  status: "draft" | "active" | "paused" | "ended";
  headline: string;
  body: string;
  cta: string;
  url: string;
  color: string;
  cover: CoverKind | null;
  image: string | null;
  placements: string[];
  countries: string[];
  startsAt: string | null;
  endsAt: string | null;
  maxImpressions: number | null;
  frequencyCap: number | null;
  cpmCents: number;
  impressions: number;
  clicks: number;
  earned: number;
};

const PLACEMENTS: [string, string][] = [
  ["rail_cover", "Side panel card"],
  ["rail_banner", "Side panel banner"],
  ["sidebar_card", "Left sidebar card"],
  ["phone_banner", "Phone banner"],
  ["job_card", "While you wait card"],
  ["job_line", "After a result line"],
  ["interstitial", "Pop-up card"],
];
const COVERS: CoverKind[] = ["laptop", "course", "jobs", "notes", "db", "deploy", "type", "print"];
const input = "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-faint";
const STATUS_CHIP: Record<string, string> = { draft: "pending", active: "active", paused: "slowed", ended: "deleted" };

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[13px] font-medium">
      {label}
      {children}
      {hint && <small className="text-xs font-normal text-faint">{hint}</small>}
    </label>
  );
}

/** Brand colours to start from: Wanlly's palette plus common brand hues. */
const SWATCHES = ["#2a78d6", "#1d4ed8", "#0ea5e9", "#0ac216", "#16a34a", "#0f766e", "#f59e0b", "#ff6a33", "#dc2626", "#db2777", "#7c3aed", "#111827"];

/** The strongest colour in a picture, for "match the picture". Greys and near-whites are skipped. */
async function colourOf(dataUrl: string): Promise<string | null> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0, 32, 32);
  const px = g.getImageData(0, 0, 32, 32).data;
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < px.length; i += 4) {
    const [r, gr, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
    const max = Math.max(r, gr, b);
    const min = Math.min(r, gr, b);
    if (a < 200 || max - min < 50 || max < 40) continue;
    const key = `${r >> 5}-${gr >> 5}-${b >> 5}`;
    const v = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    buckets.set(key, { n: v.n + 1, r: v.r + r, g: v.g + gr, b: v.b + b });
  }
  const best = [...buckets.values()].sort((x, y) => y.n - x.n)[0];
  if (!best) return null;
  return "#" + [best.r, best.g, best.b].map((v) => Math.round(v / best.n).toString(16).padStart(2, "0")).join("");
}

/** Shrinks a picture to at most 800 px wide and under 200 KB, as a data URL. */
async function pictureFrom(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 800 / bmp.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  for (const q of [0.85, 0.7, 0.55, 0.4]) {
    const url = c.toDataURL("image/webp", q);
    if (url.length < 270_000) return url;
  }
  throw new Error("That picture is too detailed. Try a smaller one.");
}

/** The card exactly as people will see it in the side panel. */
function Preview({ c }: { c: Partial<Campaign> }) {
  const sponsor = { name: c.advertiser || "Advertiser", initial: (c.advertiser || "A")[0].toUpperCase(), color: c.color || "#2a78d6", cover: c.cover ?? "laptop", headline: c.headline || "Your headline", text: c.body || "", cta: c.cta || "Learn more", image: c.image ?? undefined };
  return (
    <article className="w-[300px] overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
      <Cover sponsor={sponsor} />
      <div className="flex flex-col gap-1.5 p-3.5">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md text-[11px] font-bold text-white" style={{ background: sponsor.color }}>
            {sponsor.initial}
          </span>
          <b className="text-[13px] font-semibold">{sponsor.name}</b>
          <span className="ml-auto text-[11px] tracking-[0.07em] text-faint uppercase">Sponsored</span>
        </div>
        <h3 className="font-display text-[15px] leading-tight font-semibold tracking-[-0.01em]">{sponsor.headline}</h3>
        {sponsor.text && <p className="text-[13px] leading-snug text-muted">{sponsor.text}</p>}
        <span className="mt-1 self-start rounded-[9px] border border-line px-3 py-1.5 text-[13px] font-medium">{sponsor.cta}</span>
      </div>
    </article>
  );
}

/** Why an active campaign might not be showing right now, or null when it should be. */
function notShowing(c: Campaign, country: string | null, served: Set<number> | null): string | null {
  if (c.status !== "active") return null;
  if (country !== null && c.countries.length && !c.countries.includes(country))
    return `Not shown to you: it's for ${c.countries.join(", ")}, and your network says ${country || "unknown country"}${country ? "" : " (VPN or private relay?)"}`;
  const now = Date.now();
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return `Starts ${when(c.startsAt)}`;
  if (c.endsAt && new Date(c.endsAt).getTime() <= now) return "Past its end date";
  if (c.maxImpressions !== null && c.impressions >= c.maxImpressions) return "Reached its view limit";
  if (c.frequencyCap && seenToday(`campaign:${c.id}`) >= c.frequencyCap) return `Hidden for you today: you've seen it ${c.frequencyCap}× (its daily limit per person)`;
  if (served && !served.has(c.id)) return "Not being served right now. Check its dates and view limit, then press Pause and Start again.";
  return null;
}

const dateInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

function CampaignDialog({ start, onClose, onSaved }: { start: Partial<Campaign> | null; onClose: () => void; onSaved: () => void }) {
  const [c, setC] = useState<Partial<Campaign>>(start ?? {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch: Partial<Campaign>) => setC((x) => ({ ...x, ...patch }));

  const save = async () => {
    setBusy(true);
    setError("");
    const body = {
      advertiser: c.advertiser,
      name: c.name,
      headline: c.headline,
      body: c.body ?? "",
      cta: c.cta || "Learn more",
      url: c.url,
      color: c.color || "#2a78d6",
      cover: c.cover ?? null,
      image: c.image ?? null,
      placements: c.placements ?? ["rail_cover", "sidebar_card"],
      countries: c.countries ?? [],
      startsAt: c.startsAt || null,
      endsAt: c.endsAt || null,
      maxImpressions: c.maxImpressions ?? null,
      frequencyCap: c.frequencyCap ?? null,
      cpmCents: c.cpmCents ?? 0,
      applicationId: c.applicationId ?? null,
    };
    try {
      if (c.id) await api(`/api/admin/campaigns/${c.id}`, "PATCH", body);
      else await api("/api/admin/campaigns", "POST", body);
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={!!start} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgb(8_9_12/0.45)]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[860px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-[20px] border border-line bg-surface p-5 text-fg shadow-soft">
          <header className="flex items-start gap-3">
            <Dialog.Title className="font-display text-lg font-semibold">{c.id ? "Edit campaign" : "New campaign"}</Dialog.Title>
            <Dialog.Close aria-label="Close" className="ml-auto grid size-8 place-items-center rounded-full text-muted hover:bg-hover">
              <Icon name="x" />
            </Dialog.Close>
          </header>
          <Dialog.Description className="sr-only">The ad people will see, where it shows, and what was agreed.</Dialog.Description>
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_300px]">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Advertiser">
                <input className={input} value={c.advertiser ?? ""} onChange={(e) => set({ advertiser: e.target.value })} maxLength={80} />
              </Field>
              <Field label="Campaign name" hint="For you; not shown to people.">
                <input className={input} value={c.name ?? ""} onChange={(e) => set({ name: e.target.value })} maxLength={80} />
              </Field>
              <Field label="Headline">
                <input className={input} value={c.headline ?? ""} onChange={(e) => set({ headline: e.target.value })} maxLength={90} />
              </Field>
              <Field label="Button text">
                <input className={input} value={c.cta ?? ""} onChange={(e) => set({ cta: e.target.value })} maxLength={24} placeholder="Learn more" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="One line" hint="Optional, up to 160 characters.">
                  <input className={input} value={c.body ?? ""} onChange={(e) => set({ body: e.target.value })} maxLength={160} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Link" hint="Must start with https://. Wanlly adds utm tags so their analytics see it.">
                  <input className={input} value={c.url ?? ""} onChange={(e) => set({ url: e.target.value })} placeholder="https://" />
                </Field>
              </div>
              <div className="flex flex-col gap-1 text-[13px] font-medium">
                Brand colour
                <span className="flex items-center gap-2">
                  <input type="color" aria-label="Pick any colour" value={c.color || "#2a78d6"} onChange={(e) => set({ color: e.target.value })} className="h-8 w-10 shrink-0 rounded border border-line bg-surface" />
                  <input className={input} aria-label="Colour code" value={c.color || "#2a78d6"} onChange={(e) => set({ color: e.target.value })} maxLength={7} />
                </span>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Colour swatches">
                  {SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={hex}
                      aria-pressed={(c.color || "#2a78d6").toLowerCase() === hex}
                      onClick={() => set({ color: hex })}
                      className="size-6 rounded-full border border-line outline-offset-2 aria-pressed:outline-2 aria-pressed:outline-fg"
                      style={{ background: hex }}
                    />
                  ))}
                  {c.image && (
                    <button
                      type="button"
                      onClick={async () => {
                        const hex = await colourOf(c.image!).catch(() => null);
                        if (hex) set({ color: hex });
                        else setError("Couldn't find a strong colour in the picture.");
                      }}
                      className="rounded-full border border-line px-2 text-[11px] font-normal text-muted hover:text-fg"
                    >
                      Match picture
                    </button>
                  )}
                </div>
              </div>
              <Field label="Picture" hint="Their own image, or one of Wanlly's illustrations.">
                <span className="flex items-center gap-2">
                  <label className={`${btnGhost} cursor-pointer`}>
                    Upload
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          set({ image: await pictureFrom(f) });
                        } catch (err) {
                          setError((err as Error).message);
                        }
                      }}
                    />
                  </label>
                  {c.image ? (
                    <button type="button" className={btnGhost} onClick={() => set({ image: null })}>
                      Remove
                    </button>
                  ) : (
                    <select className={input} value={c.cover ?? "laptop"} onChange={(e) => set({ cover: e.target.value as CoverKind })}>
                      {COVERS.map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                  )}
                </span>
              </Field>
              <div className="sm:col-span-2">
                <span className="text-[13px] font-medium">Where it shows</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {PLACEMENTS.map(([k, label]) => {
                    const on = (c.placements ?? ["rail_cover", "sidebar_card"]).includes(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          const cur = c.placements ?? ["rail_cover", "sidebar_card"];
                          set({ placements: on ? cur.filter((x) => x !== k) : [...cur, k] });
                        }}
                        className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-accent-line bg-accent-soft font-medium text-accent" : "border-line text-muted"}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-1 text-[13px] font-medium sm:col-span-2">
                Countries
                <CountryPicker value={c.countries ?? []} onChange={(countries) => set({ countries })} input={input} />
                <small className="text-xs font-normal text-faint">Uses each visitor&apos;s network country. None picked means everywhere.</small>
              </div>
              <Field label="Price per 1,000 views (US$)">
                <input type="number" min={0} step={0.1} className={input} value={(c.cpmCents ?? 0) / 100} onChange={(e) => set({ cpmCents: Math.round(Number(e.target.value) * 100) })} />
              </Field>
              <Field label="Starts">
                <input type="date" className={input} value={dateInput(c.startsAt ?? null)} onChange={(e) => set({ startsAt: e.target.value || null })} />
              </Field>
              <Field label="Ends">
                <input type="date" className={input} value={dateInput(c.endsAt ?? null)} onChange={(e) => set({ endsAt: e.target.value || null })} />
              </Field>
              <Field label="Stop after views" hint="Total for the campaign. Empty for no cap.">
                <input type="number" min={0} className={input} value={c.maxImpressions ?? ""} onChange={(e) => set({ maxImpressions: e.target.value ? Number(e.target.value) : null })} />
              </Field>
              <div className="flex flex-col gap-1 text-[13px] font-medium">
                Views per person a day
                <span className="flex flex-wrap gap-1">
                  {([null, 1, 2, 3, 5, 10] as const).map((n) => (
                    <button
                      key={String(n)}
                      type="button"
                      aria-pressed={(c.frequencyCap ?? null) === n}
                      onClick={() => set({ frequencyCap: n })}
                      className={`rounded-full border px-2.5 py-1 text-xs ${(c.frequencyCap ?? null) === n ? "border-accent-line bg-accent-soft font-medium text-accent" : "border-line font-normal text-muted"}`}
                    >
                      {n === null ? "No limit" : n}
                    </button>
                  ))}
                </span>
                <small className="text-xs font-normal text-faint">After this many views, the same person sees other ads until tomorrow.</small>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-medium">Preview</span>
              <Preview c={c} />
              <small className="text-xs text-faint">Pop-ups and banners use the same picture, headline and colour.</small>
            </div>
          </div>
          {error && <p className="text-[13px] text-bad">{error}</p>}
          <div className="flex justify-end gap-2">
            <Dialog.Close className={btnGhost}>Cancel</Dialog.Close>
            <button type="button" className={btnDark} onClick={save} disabled={busy}>
              {busy ? "Saving…" : c.id ? "Save" : "Create as draft"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type Delivery = {
  country: string;
  campaigns: {
    id: number;
    name: string;
    advertiser: string;
    status: string;
    countries: string[];
    startsAt: string | null;
    endsAt: string | null;
    views: number;
    maxImpressions: number | null;
    frequencyCap: number | null;
    checks: { active: boolean; started: boolean; notEnded: boolean; country: boolean; viewsLeft: boolean; placements: boolean };
    served: boolean;
  }[];
};

/** The ad server's rules for each campaign, checked for you right now: why it is or isn't showing. */
function DeliveryCheck({ tick, onReset }: { tick: number; onReset: () => void }) {
  const [d, setD] = useState<Delivery | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    api<Delivery>("/api/admin/campaigns/delivery")
      .then((x) => live && setD(x))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [tick]);
  if (error) return <Card title="Delivery check"><Empty>{error}</Empty></Card>;
  if (!d) return <Card title="Delivery check"><Empty>Checking…</Empty></Card>;
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "");
  return (
    <Card title="Delivery check" note={`Each campaign against the ad server's rules, for you right now. Your network country: ${d.country || "unknown (VPN or private relay?)"}.`}>
      {d.campaigns.length === 0 ? (
        <Empty>No campaigns yet.</Empty>
      ) : (
        <ul className="flex flex-col">
          {d.campaigns.map((c) => {
            const capped = !!c.frequencyCap && seenToday(`campaign:${c.id}`) >= c.frequencyCap;
            const rules: [boolean, string, string][] = [
              [c.checks.active, "Running", c.status === "paused" ? "Paused: press Start" : c.status === "draft" ? "Still a draft: press Start" : `Status is ${c.status}`],
              [c.checks.started, "Started", `Starts ${fmt(c.startsAt)}`],
              [c.checks.notEnded, "Not ended", `Ended ${fmt(c.endsAt)}`],
              [c.checks.country, `Shown in ${d.country || "your country"}`, `Only for ${c.countries.join(", ")}; you're in ${d.country || "an unknown country"}`],
              [c.checks.viewsLeft, "Views left", `Used all ${c.maxImpressions} views`],
              [c.checks.placements, "Has places to show", "No places picked: edit and choose where it shows"],
              [!capped, "Under your daily limit", `You've seen it ${c.frequencyCap}× today`],
            ];
            const ok = c.served && !capped;
            return (
              <li key={c.id} className="flex flex-col gap-1.5 border-t border-line py-3 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="font-medium">{c.name}</b>
                  <span className="text-xs text-muted">{c.advertiser}</span>
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${ok ? "bg-good/14 text-good" : "bg-bad/10 text-bad"}`}>{ok ? "Being served to you" : "Not served to you"}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {rules.map(([pass, good, bad]) => (
                    <span key={good} className={`rounded-full border px-2 py-0.5 text-xs ${pass ? "border-line text-muted" : "border-bad/40 text-bad"}`}>
                      {pass ? `✓ ${good}` : `✗ ${bad}`}
                    </span>
                  ))}
                  {capped && (
                    <button type="button" onClick={onReset} className="text-xs text-muted underline underline-offset-2">
                      Reset my views
                    </button>
                  )}
                </div>
                <small className="text-xs text-faint">
                  {c.views} views so far{c.maxImpressions ? ` of ${c.maxImpressions}` : ""}
                  {c.startsAt || c.endsAt ? ` · runs ${fmt(c.startsAt) || "now"} to ${fmt(c.endsAt) || "no end"}` : ""}
                </small>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function AdvertisersTab() {
  const [status, setStatus] = useState<"pending" | "approved" | "declined" | "all">("pending");
  const [apps, setApps] = useState<Application[] | null>(null);
  const [camps, setCamps] = useState<Campaign[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Partial<Campaign> | null>(null);
  const [tick, setTick] = useState(0);
  // What the live ad server sends this browser right now, and the network country it sees.
  const [serving, setServing] = useState<{ country: string; ids: Set<number> } | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/ads", { cache: "no-store" })
      .then((r) => r.json())
      .then((b: { country?: string; ads?: { campaignId: number }[] }) => live && setServing({ country: (b.country ?? "").toUpperCase(), ids: new Set((b.ads ?? []).map((a) => a.campaignId)) }))
      .catch(() => {});
    Promise.all([api<{ applications: Application[] }>(`/api/admin/advertisers${status === "all" ? "" : `?status=${status}`}`), api<{ campaigns: Campaign[] }>("/api/admin/campaigns")])
      .then(([a, c]) => {
        if (!live) return;
        setApps(a.applications);
        setCamps(c.campaigns);
        setError("");
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [status, tick]);
  const reload = () => setTick((t) => t + 1);

  const decide = async (a: Application, next: Application["status"]) => {
    try {
      await api(`/api/admin/advertisers/${a.id}`, "PATCH", { status: next });
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const setCampaign = async (c: Campaign, next: Campaign["status"]) => {
    try {
      await api(`/api/admin/campaigns/${c.id}`, "PATCH", { status: next });
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const reply = (a: Application) =>
    `mailto:${encodeURIComponent(a.email)}?subject=${encodeURIComponent(`Advertising on Wanlly: ${a.company}`)}&body=${encodeURIComponent(
      `Hi ${a.contactName.split(" ")[0]},\n\nThanks for applying to advertise on Wanlly.\n\n\n\nLouis, Wanlly`,
    )}`;

  if (error && !apps) return <Empty>{error}</Empty>;
  if (!apps || !camps) return <Empty>Loading…</Empty>;
  const active = camps.filter((c) => c.status === "active");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-3.5">
          <span className="text-[11px] font-medium tracking-[0.08em] text-faint uppercase">Running now</span>
          <span className="font-display text-2xl font-semibold">{active.length}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-3.5">
          <span className="text-[11px] font-medium tracking-[0.08em] text-faint uppercase">Views, all campaigns</span>
          <span className="font-display text-2xl font-semibold">{num(camps.reduce((n, c) => n + c.impressions, 0))}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-3.5">
          <span className="text-[11px] font-medium tracking-[0.08em] text-faint uppercase">Clicks</span>
          <span className="font-display text-2xl font-semibold">{num(camps.reduce((n, c) => n + c.clicks, 0))}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-3.5">
          <span className="text-[11px] font-medium tracking-[0.08em] text-faint uppercase">Earned (booked)</span>
          <span className="font-display text-2xl font-semibold">{usd(camps.reduce((n, c) => n + c.earned, 0))}</span>
        </div>
      </div>

      <DeliveryCheck
        tick={tick}
        onReset={() => {
          resetSeen();
          reload();
        }}
      />
      <Card
        title="Campaigns"
        note={`Active campaigns replace the house sponsors in the slots they're booked for. Earned = views × the agreed price.${serving ? ` Serving to you now: ${serving.ids.size} campaign${serving.ids.size === 1 ? "" : "s"} (your network country: ${serving.country || "unknown"}).` : ""}`}
        actions={
          <button type="button" className={btnDark} onClick={() => setEditing({ placements: ["rail_cover", "sidebar_card"], color: "#2a78d6", cta: "Learn more" })}>
            <Icon name="plus" size={14} /> New campaign
          </button>
        }
      >
        {error && <p className="text-[13px] text-bad">{error}</p>}
        {camps.length ? (
          <Table
            head={["Campaign", "Status", "Views", "Clicks", "Click rate", "Earned", ""]}
            numeric={[2, 3, 4, 5]}
            rows={camps.map((c) => [
              <span key="n" className="flex flex-col">
                <b className="font-medium">{c.name}</b>
                <small className="text-xs text-muted">
                  {c.advertiser} · {c.countries.length ? c.countries.join(", ") : "all countries"}
                  {c.endsAt && ` · ends ${when(c.endsAt)}`}
                  {c.frequencyCap ? ` · ${c.frequencyCap}× a day per person` : ""}
                </small>
                {notShowing(c, serving?.country ?? null, serving?.ids ?? null) && (
                  <small className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-bad">
                    {notShowing(c, serving?.country ?? null, serving?.ids ?? null)}
                    {notShowing(c, serving?.country ?? null, serving?.ids ?? null)?.startsWith("Hidden for you") && (
                      <button
                        type="button"
                        className="text-muted underline underline-offset-2"
                        onClick={() => {
                          resetSeen();
                          reload();
                        }}
                      >
                        Reset my views
                      </button>
                    )}
                  </small>
                )}
              </span>,
              <Chip key="s" s={STATUS_CHIP[c.status]} label={c.status} />,
              `${num(c.impressions)}${c.maxImpressions ? ` / ${num(c.maxImpressions)}` : ""}`,
              num(c.clicks),
              c.impressions ? pct(c.clicks / c.impressions) : "–",
              usd(c.earned),
              <span key="a" className="flex justify-end gap-1.5">
                {c.status !== "active" && c.status !== "ended" && (
                  <button type="button" className={btnDark} onClick={() => setCampaign(c, "active")}>
                    Start
                  </button>
                )}
                {c.status === "active" && (
                  <button type="button" className={btnGhost} onClick={() => setCampaign(c, "paused")}>
                    Pause
                  </button>
                )}
                <button type="button" className={btnGhost} onClick={() => setEditing(c)}>
                  Edit
                </button>
                {c.status !== "ended" && (
                  <button type="button" className={btnGhost} onClick={() => window.confirm(`End "${c.name}"? It stops showing for good.`) && setCampaign(c, "ended")}>
                    End
                  </button>
                )}
              </span>,
            ])}
          />
        ) : (
          <Empty>No campaigns yet. Approve an application, then create one.</Empty>
        )}
      </Card>

      <Card
        title="Applications"
        note="From the Advertise page. Approve, reply from your own email, then create their campaign."
        actions={
          <Pills
            label="Show"
            value={status}
            onChange={setStatus}
            options={[
              ["pending", "Waiting"],
              ["approved", "Approved"],
              ["declined", "Declined"],
              ["all", "All"],
            ]}
          />
        }
      >
        {apps.length === 0 ? (
          <Empty>Nothing here. Share wanlly&apos;s /advertise page with brands you&apos;d like to work with.</Empty>
        ) : (
          <ul className="flex flex-col">
            {apps.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start gap-3 border-t border-line py-3 first:border-t-0 first:pt-0">
                <div className="min-w-0 flex-1 basis-[320px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="font-semibold">{a.company}</b>
                    <span className="text-[13px] text-muted">
                      {a.contactName} · {a.email}
                    </span>
                    <Chip s={a.status} />
                  </div>
                  <small className="mt-1 block text-xs text-faint">
                    {[a.category, a.budget, a.country && `wants ${a.country}`, a.website, a.formats.length && a.formats.join(", "), `applied ${when(a.createdAt)}`].filter(Boolean).join(" · ")}
                  </small>
                  {a.message && <p className="mt-1 text-[13px] whitespace-pre-wrap">{a.message}</p>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <a href={reply(a)} className={btnGhost}>
                    Reply
                  </a>
                  {a.status === "approved" ? (
                    <button type="button" className={btnDark} onClick={() => setEditing({ advertiser: a.company, name: `${a.company} launch`, url: a.website?.startsWith("https://") ? a.website : "", applicationId: a.id, placements: ["rail_cover", "sidebar_card"], color: "#2a78d6", cta: "Learn more" })}>
                      Create campaign
                    </button>
                  ) : (
                    <button type="button" className={btnDark} onClick={() => decide(a, "approved")}>
                      Approve
                    </button>
                  )}
                  {a.status !== "declined" && (
                    <button type="button" className={btnGhost} onClick={() => decide(a, "declined")}>
                      Decline
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CampaignDialog key={editing?.id ?? (editing ? "new" : "none")} start={editing} onClose={() => setEditing(null)} onSaved={reload} />
    </div>
  );
}
