"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SAY } from "@/lib/messages";
import { Icon } from "../icon";
import { SpinLoader } from "../spin-mark";

type Item = { id: number; name: string; updatedAt: string };

const IDEAS = ["A booking page for a salon, with a form that saves requests", "A budget tracker for students with categories and a chart", "A quiz app for revising biology, with scores"];

/** The Builder's front page: this person's apps, and a box to start a new one. */
export function BuilderHome() {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/build", { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => setItems(b.projects ?? []))
      .catch(() => setItems([]));
  }, []);
  const start = async (text: string) => {
    setBusy(true);
    setError("");
    try {
      const name = text.trim().replace(/\s+/g, " ").slice(0, 60) || "New app";
      const r = await fetch("/api/build", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? SAY.busy);
      try {
        if (text.trim()) sessionStorage.setItem(`wanlly-build-first-${b.id}`, text.trim());
      } catch {}
      router.push(`/build/${b.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : SAY.offline);
      setBusy(false);
    }
  };
  return (
    <main className="mx-auto flex w-full max-w-[880px] flex-col gap-8 px-4 py-10 md:px-8">
      <header className="flex flex-col gap-2">
        <span className="text-xs font-medium tracking-[0.08em] text-accent uppercase">Builder</span>
        <h1 className="font-display text-[clamp(28px,4vw,40px)] leading-[1.05] font-semibold tracking-[-0.035em]">Build a whole app, one step at a time</h1>
        <p className="max-w-[60ch] text-muted">
          Describe what you want. The AI plans it, writes real files, previews it as it goes and fixes what breaks. You see every step and what it costs, and you can stop any time.
        </p>
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void start(idea);
        }}
        className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4"
      >
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={3}
          placeholder="What do you want to build?"
          className="w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-faint"
        />
        <div className="flex flex-wrap items-center gap-2">
          {IDEAS.map((i) => (
            <button key={i} type="button" onClick={() => setIdea(i)} className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-faint hover:text-fg">
              {i}
            </button>
          ))}
          <button type="submit" disabled={busy} className="ml-auto rounded-lg bg-fg px-4 py-2 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-60">
            {busy ? "Starting…" : idea.trim() ? "Start building" : "Start an empty app"}
          </button>
        </div>
        {error && <p className="text-[13px] text-bad">{error}</p>}
      </form>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Your apps</h2>
        {!items ? (
          <div className="py-6">
            <SpinLoader size={32} />
          </div>
        ) : items.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {items.map((p) => (
              <li key={p.id}>
                <Link href={`/build/${p.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 hover:border-faint">
                  <span className="grid size-9 place-items-center rounded-lg bg-hover">
                    <Icon name="code" size={16} />
                  </span>
                  <span className="min-w-0">
                    <b className="block truncate text-sm font-semibold">{p.name}</b>
                    <small className="text-xs text-muted">Updated {new Date(p.updatedAt).toLocaleDateString()}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No apps yet. Your first one starts above.</p>
        )}
      </section>
    </main>
  );
}
