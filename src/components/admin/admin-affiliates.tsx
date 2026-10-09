"use client";

import { useEffect, useState } from "react";
import { AFFILIATE_PLACES, COVER_KINDS, type Affiliate } from "@/lib/affiliates";
import { Card, Empty, api, btnDark, btnGhost } from "./admin-ui";

/*
 * Affiliate links: Wanlly's own offers that fill every place no sold campaign has booked. Each
 * has keywords, so the app shows the one that fits what someone is working on.
 */

const PLACE_LABEL: Record<string, string> = {
  rail_cover: "Side panel card",
  sidebar_card: "Left sidebar card",
  job_card: "While you wait card",
  job_line: "Line after a reply",
  interstitial: "Pop-up card",
  phone_banner: "Phone bar",
};

const input = "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-faint";

const blank = (): Affiliate => ({
  id: `a${Date.now().toString(36)}`,
  active: true,
  name: "",
  headline: "",
  text: "",
  cta: "Learn more",
  url: "https://",
  color: "#2a78d6",
  cover: "laptop",
  keywords: [],
  places: [...AFFILIATE_PLACES],
});

export function AffiliatesCard() {
  const [list, setList] = useState<Affiliate[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api<{ affiliates: Affiliate[] }>("/api/admin/affiliates")
      .then((b) => setList(b.affiliates))
      .catch((e: Error) => setNote(e.message));
  }, []);

  const change = (id: string, patch: Partial<Affiliate>) => {
    setList((xs) => (xs ?? []).map((a) => (a.id === id ? { ...a, ...patch } : a)));
    setDirty(true);
  };

  const save = async () => {
    setBusy(true);
    setNote("");
    try {
      const b = await api<{ affiliates: Affiliate[] }>("/api/admin/affiliates", "PUT", { affiliates: list });
      const dropped = (list?.length ?? 0) - b.affiliates.length;
      setList(b.affiliates);
      setDirty(false);
      setNote(`Saved. Changes reach the app within 5 minutes.${dropped > 0 ? ` ${dropped} without a name or an https:// link ${dropped === 1 ? "was" : "were"} left out.` : ""}`);
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Affiliate links"
      note="Your own offers (Jumia, hosting, courses…) that fill every place no sold campaign has booked, instead of Wanlly's placeholders. Add keywords: after each reply, the offer whose words match what the person asked about is shown first."
      actions={
        <>
          <button
            type="button"
            className={btnGhost}
            onClick={() => {
              const a = blank();
              setList((xs) => [...(xs ?? []), a]);
              setOpen(a.id);
              setDirty(true);
            }}
          >
            Add link
          </button>
          <button type="button" className={btnDark} onClick={save} disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      {note && <p className="text-[13px] text-muted">{note}</p>}
      {!list ? (
        <Empty>Loading…</Empty>
      ) : list.length === 0 ? (
        <Empty>No affiliate links yet. Until you add some, Wanlly shows its built-in placeholders.</Empty>
      ) : (
        <ul className="flex flex-col">
          {list.map((a) => (
            <li key={a.id} className="border-t border-line py-2.5 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-2.5">
                {a.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- the landing page's own picture
                  <img src={a.image} alt="" className="h-6 w-10 rounded-md border border-line object-cover" />
                ) : (
                  <span className="grid size-6 place-items-center rounded-md text-[11px] font-bold text-white" style={{ background: a.color }}>
                    {(a.name || "?").charAt(0).toUpperCase()}
                  </span>
                )}
                <b className="text-[13px] font-semibold">{a.name || "New link"}</b>
                <span className="min-w-0 flex-1 truncate text-xs text-muted">
                  {a.keywords.length ? `Matches: ${a.keywords.join(", ")}` : "No keywords: shown in rotation"}
                </span>
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <input type="checkbox" checked={a.active} onChange={(e) => change(a.id, { active: e.target.checked })} /> Live
                </label>
                <button type="button" className={btnGhost} onClick={() => setOpen(open === a.id ? null : a.id)}>
                  {open === a.id ? "Close" : "Edit"}
                </button>
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => {
                    if (!window.confirm(`Remove ${a.name || "this link"}?`)) return;
                    setList((xs) => (xs ?? []).filter((x) => x.id !== a.id));
                    setDirty(true);
                  }}
                >
                  Remove
                </button>
              </div>
              {open === a.id && <LinkPreview url={a.url} image={a.image} onImage={(image) => change(a.id, { image })} />}
              {open === a.id && (
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  {(
                    [
                      ["name", "Name", 60, "Jumia"],
                      ["headline", "Headline", 90, "Student laptops, delivered"],
                      ["cta", "Button text", 24, "Shop now"],
                      ["url", "Affiliate link (https://)", 500, "https://…"],
                    ] as const
                  ).map(([k, label, max, ph]) => (
                    <label key={k} className="flex flex-col gap-1 text-[13px] font-medium">
                      {label}
                      <input className={input} maxLength={max} placeholder={ph} value={a[k]} onChange={(e) => change(a.id, { [k]: e.target.value })} />
                    </label>
                  ))}
                  <label className="flex flex-col gap-1 text-[13px] font-medium sm:col-span-2">
                    Picture link <span className="font-normal text-faint">optional, https:// image shown on the ad (filled in by “Use this picture”)</span>
                    <input className={input} maxLength={800} placeholder="https://…/banner.jpg" value={a.image ?? ""} onChange={(e) => change(a.id, { image: e.target.value.trim() || undefined })} />
                  </label>
                  <label className="flex flex-col gap-1 text-[13px] font-medium sm:col-span-2">
                    One line
                    <input className={input} maxLength={160} value={a.text} onChange={(e) => change(a.id, { text: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1 text-[13px] font-medium sm:col-span-2">
                    Keywords <span className="font-normal text-faint">comma separated, e.g. website, hosting, domain, wordpress</span>
                    <input
                      className={input}
                      value={a.keywords.join(", ")}
                      onChange={(e) =>
                        change(a.id, {
                          keywords: e.target.value
                            .split(",")
                            .map((x) => x.trim().toLowerCase())
                            .filter((x, i, arr) => x || i === arr.length - 1),
                        })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[13px] font-medium">
                    Colour
                    <span className="flex items-center gap-2">
                      <input type="color" value={a.color} onChange={(e) => change(a.id, { color: e.target.value })} className="h-8 w-10 rounded border border-line bg-surface" />
                      <input className={input} value={a.color} maxLength={7} onChange={(e) => change(a.id, { color: e.target.value })} />
                    </span>
                  </label>
                  <label className="flex flex-col gap-1 text-[13px] font-medium">
                    Illustration
                    <select className={input} value={a.cover} onChange={(e) => change(a.id, { cover: e.target.value as Affiliate["cover"] })}>
                      {COVER_KINDS.map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-col gap-1.5 text-[13px] font-medium sm:col-span-2">
                    Where it shows
                    <div className="flex flex-wrap gap-1.5">
                      {AFFILIATE_PLACES.map((p) => {
                        const on = a.places.includes(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            aria-pressed={on}
                            onClick={() => change(a.id, { places: on ? a.places.filter((x) => x !== p) : [...a.places, p] })}
                            className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-accent-line bg-accent-soft font-medium text-accent" : "border-line font-normal text-muted"}`}
                          >
                            {PLACE_LABEL[p]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-faint">Clicks are counted in Ads &amp; revenue → Dashboard (as affiliate:…), and each link gets utm_source=wanlly so your affiliate dashboard can see them too.</p>
    </Card>
  );
}

type Preview = { url: string; host: string; title: string; description: string; site: string; image?: string };

/** What the affiliate link opens: the landing page's title, description and share picture. */
function LinkPreview({ url, image, onImage }: { url: string; image?: string; onImage: (image: string | undefined) => void }) {
  const [p, setP] = useState<Preview | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!/^https:\/\/[^/]+\.[^/]+/.test(url)) return;
    let live = true;
    // Wait for typing to stop before opening the page.
    const t = window.setTimeout(() => {
      setState("loading");
      api<Preview>(`/api/admin/affiliates/preview?url=${encodeURIComponent(url)}`)
        .then((x) => {
          if (!live) return;
          setP(x);
          setState("idle");
        })
        .catch((e: Error) => {
          if (!live) return;
          setError(e.message);
          setState("error");
        });
    }, 600);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [url]);
  return (
    <div className="mt-3 flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-3 sm:flex-row">
      <div className="aspect-[1.91/1] w-full shrink-0 overflow-hidden rounded-lg border border-line bg-hover sm:w-[240px]">
        {p?.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote share picture, previewed as-is
          <img src={p.image} alt="" className="block size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-xs text-faint">{state === "loading" ? "Opening the page…" : "No share picture"}</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-[13px]">
        <span className="text-[11px] font-medium tracking-[0.08em] text-faint uppercase">Landing page{p?.host ? ` · ${p.host}` : ""}</span>
        {state === "error" ? (
          <p className="text-bad">{error}</p>
        ) : p ? (
          <>
            <b className="line-clamp-2 font-semibold">{p.title || "No title"}</b>
            {p.description && <p className="line-clamp-3 text-muted">{p.description}</p>}
            <div className="mt-auto flex flex-wrap gap-2 pt-1.5">
              {p.image && p.image !== image && (
                <button type="button" className={btnDark} onClick={() => onImage(p.image)}>
                  Use this picture in the ad
                </button>
              )}
              {image && (
                <button type="button" className={btnGhost} onClick={() => onImage(undefined)}>
                  {image === p.image ? "Picture in use · remove" : "Remove picture"}
                </button>
              )}
              <a href={p.url} target="_blank" rel="noopener noreferrer" className={btnGhost}>
                Open page ↗
              </a>
            </div>
          </>
        ) : (
          <p className="text-muted">{state === "loading" ? "Opening the page…" : "Add an https:// link to see its page."}</p>
        )}
      </div>
    </div>
  );
}
