"use client";

import { useState, type FormEvent } from "react";

const TOPICS = ["General", "Advertise on Wanlly", "Partnerships", "Press", "Support", "Privacy"];
const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-fg";

export function ContactForm({ initialTopic = "General" }: { initialTopic?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("busy");
    setError("");
    try {
      const r = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))) });
      const out = await r.json();
      if (!r.ok) throw new Error(out.error || "Something went wrong.");
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setState("idle");
    }
  }

  if (state === "sent")
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-6">
        <b className="font-display text-lg font-semibold">Thanks, we&apos;ve got it.</b>
        <p className="text-sm text-muted">We read every message and usually reply within two working days.</p>
      </div>
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <label htmlFor="c-name" className="flex flex-col gap-1.5 text-[13px] font-medium">
          Name
          <input id="c-name" name="name" required autoComplete="name" className={field} />
        </label>
        <label htmlFor="c-email" className="flex flex-col gap-1.5 text-[13px] font-medium">
          Email
          <input id="c-email" name="email" type="email" required autoComplete="email" className={field} />
        </label>
      </div>
      <label htmlFor="c-topic" className="flex flex-col gap-1.5 text-[13px] font-medium">
        Topic
        <select id="c-topic" name="topic" defaultValue={initialTopic} className={field}>
          {TOPICS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label htmlFor="c-message" className="flex flex-col gap-1.5 text-[13px] font-medium">
        Message
        <textarea id="c-message" name="message" required rows={5} className={`${field} resize-y`} placeholder="How can we help?" />
      </label>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {error && (
        <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-[13px] text-bad">
          {error}
        </p>
      )}
      <button type="submit" disabled={state === "busy"} className="self-start rounded-full bg-fg px-5 py-2.5 text-sm font-semibold text-bg disabled:opacity-60">
        {state === "busy" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
