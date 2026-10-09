import "server-only";
import { rawSql } from "@/db";
import { streamReply } from "./ai";

/*
 * What Wanlly remembers about a person: a short profile written by the model from their chats,
 * so answers fit them (their level, field, projects, how they like replies) and the home screen
 * can suggest what to do next. The person can read, edit, switch off or erase it on their
 * Profile page. Sensitive things are never kept.
 */

export type Memory = {
  /** A few short lines about the person, in plain words. */
  about: string;
  /** Topics and tools they're into, as single words or short phrases (also used to match offers). */
  interests: string[];
  /** Three things they might want to do next, written as prompts. */
  suggestions: string[];
  updatedAt: string;
};

const EVERY_MS = 15 * 60_000;

export function cleanMemory(v: unknown): Memory | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const list = (x: unknown, n: number, len: number) =>
    Array.isArray(x) ? x.map((s) => String(s).trim().slice(0, len)).filter(Boolean).slice(0, n) : [];
  const about = typeof o.about === "string" ? o.about.trim().slice(0, 900) : "";
  const interests = list(o.interests, 10, 40).map((s) => s.toLowerCase());
  const suggestions = list(o.suggestions, 3, 80);
  if (!about && !interests.length && !suggestions.length) return null;
  return { about, interests, suggestions, updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString() };
}

/** The person's memory if they have it switched on; null otherwise (or before migration 0013). */
export async function loadMemory(userId: string): Promise<Memory | null> {
  try {
    const q = rawSql();
    const [row] = (await q`select memory, settings from users where id = ${userId}`) as { memory: unknown; settings: { memory?: boolean } | null }[];
    if (!row || row.settings?.memory === false) return null;
    return cleanMemory(row.memory);
  } catch {
    return null;
  }
}

/** A few lines for the system prompt, so replies fit the person. */
export function memoryPrompt(m: Memory | null): string {
  if (!m?.about && !m?.interests.length) return "";
  return (
    "\n\nWhat Wanlly remembers about this person, from earlier chats. Use it to pitch answers at the right level and pick " +
    "relevant examples; don't recite it or mention that you remember unless they ask:\n<about_the_person>\n" +
    `${m.about}${m.interests.length ? `\nInterests: ${m.interests.join(", ")}` : ""}\n</about_the_person>`
  );
}

const SYSTEM =
  "You keep a short, useful profile of a person who uses Wanlly, an AI workspace for students and creators. " +
  "Update the profile from their latest messages. Keep what's still true, add what's new, drop what's outdated. " +
  "Only keep things that help future answers: what they study or do, their level, projects they're working on, " +
  "tools and topics they use, and how they like answers (short, detailed, examples, language). " +
  "Never keep: health, religion, politics, sexuality, ethnicity, money details, passwords or keys, exact addresses, " +
  "phone numbers, or anything about other people. If there's nothing useful, return the profile unchanged. " +
  'Reply with JSON only: {"about": "up to 5 short lines", "interests": ["up to 8 short words"], ' +
  '"suggestions": ["3 prompts they might send next, each under 60 characters, in their voice"]}';

/**
 * Refreshes the memory from the person's recent messages, at most every 15 minutes. Runs after
 * the reply has been sent, on the free Gemini model, so it never slows a chat or costs credits.
 */
export async function maybeUpdateMemory(userId: string, recent: string[]): Promise<void> {
  try {
    const q = rawSql();
    const [row] = (await q`select memory, settings from users where id = ${userId}`) as { memory: unknown; settings: { memory?: boolean } | null }[];
    if (!row || row.settings?.memory === false) return;
    const current = cleanMemory(row.memory);
    if (current && Date.now() - new Date(current.updatedAt).getTime() < EVERY_MS) return;
    // Their own words only: attached files' contents are left out.
    const messages = recent.map((m) => m.replace(/<file name=[\s\S]*?<\/file>/g, "").trim().slice(0, 800)).filter(Boolean).slice(-6);
    if (!messages.length) return;
    let text = "";
    for await (const ev of streamReply({
      modelId: "gemini-flash",
      tool: "chat",
      system: SYSTEM,
      turns: [{ role: "user", text: `Current profile:\n${JSON.stringify(current ?? { about: "", interests: [], suggestions: [] })}\n\nTheir latest messages:\n${messages.map((m) => `- ${m}`).join("\n")}` }],
      signal: AbortSignal.timeout(30_000),
    })) {
      if (ev.type === "text") text += ev.text;
    }
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return;
    const next = cleanMemory({ ...JSON.parse(json), updatedAt: new Date().toISOString() });
    if (!next) return;
    await q`update users set memory = ${JSON.stringify(next)}::jsonb where id = ${userId}`;
  } catch (e) {
    console.error("memory update failed", e instanceof Error ? e.message : e);
  }
}
