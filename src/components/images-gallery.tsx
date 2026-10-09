"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icon";

type Saved = { id: number; prompt: string; createdAt: string };

/** The pictures you've made, newest first, on the Images home. Each opens full size; each can go. */
export function ImagesGallery() {
  const [items, setItems] = useState<Saved[] | null>(null);
  useEffect(() => {
    const load = () =>
      fetch("/api/images", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { images: [] }))
        .then((b: { images: Saved[] }) => setItems(b.images))
        .catch(() => setItems([]));
    load();
    window.addEventListener("wanlly:images", load);
    return () => window.removeEventListener("wanlly:images", load);
  }, []);
  if (!items?.length) return null;
  return (
    <section aria-label="Your images" className="flex flex-col gap-2">
      <h2 className="text-[11px] font-medium tracking-[0.08em] text-faint uppercase">Your images</h2>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((it) => (
          <li key={it.id} className="group relative overflow-hidden rounded-xl border border-line bg-code">
            <a href={`/api/images/${it.id}`} target="_blank" rel="noreferrer" title={it.prompt}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/images/${it.id}`} alt={it.prompt} loading="lazy" className="aspect-square w-full object-cover" />
            </a>
            <button
              type="button"
              aria-label={`Delete ${it.prompt}`}
              onClick={async () => {
                if (!window.confirm("Delete this image?")) return;
                await fetch(`/api/images/${it.id}`, { method: "DELETE" }).catch(() => {});
                setItems((xs) => (xs ?? []).filter((x) => x.id !== it.id));
              }}
              className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <Icon name="x" size={13} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
