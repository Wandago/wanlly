import "server-only";
import { GITHUB_TOOL } from "./build";
import Anthropic, { toFile } from "@anthropic-ai/sdk";
import { MODELS, type Providers, type ToolId } from "./catalog";

/*
 * The model providers behind chat. Each one streams the same small set of events, so the chat
 * route doesn't care which model answered. Keys live only in Cloudflare secrets.
 */

/** One turn of a conversation. `files` are images or PDFs, as base64, for this turn only. */
export type Turn = { role: "user" | "assistant"; text: string; files?: { mime: string; data: string }[] };
export type ReplyEvent = { type: "text"; text: string } | { type: "done"; inputTokens: number; outputTokens: number; stop: string };

/** Claude models: API id and US dollars per million tokens (input, output). */
const CLAUDE: Record<string, { api: string; usdIn: number; usdOut: number; fallbacks: boolean; cacheRead: number }> = {
  haiku: { api: "claude-haiku-5-5", usdIn: 0.1, usdOut: 0.5, fallbacks: false, cacheRead: 0.1 },
  sonnet: { api: "claude-sonnet-5-5", usdIn: 2, usdOut: 10, fallbacks: true, cacheRead: 0.1 },
  opus: { api: "claude-opus-5-5", usdIn: 4, usdOut: 20, fallbacks: true, cacheRead: 0.05 },
  fable: { api: "claude-fable-5-1", usdIn: 10, usdOut: 50, fallbacks: true, cacheRead: 0.025 },
};
/** A cache write costs 1.25 times a normal input token (5-minute cache). */
const CACHE_WRITE = 1.25;

/**
 * Input tokens at full price that cost the same as what Claude actually read: uncached tokens,
 * plus cache writes at 1.25× and cache reads at the model's discount (a twentieth on Opus). Used
 * for the bill and for credits, so people pay less when their files are re-read from cache.
 */
export function billedInput(modelId: string, usage: { input_tokens: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }) {
  const read = CLAUDE[modelId]?.cacheRead ?? 0.1;
  return Math.ceil(usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) * CACHE_WRITE + (usage.cache_read_input_tokens ?? 0) * read);
}

export function providers(): Providers {
  const google = geminiKeys().length > 0;
  const nvidia = !!process.env.NVIDIA_API_KEY;
  return {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    google,
    argo: !!argoModel(),
    nvidia,
    xai: !!process.env.XAI_API_KEY,
    deepseek: !!process.env.DEEPSEEK_API_KEY,
    // Auto (free) runs when any free host has a key; Gemini is its last resort.
    pool: google || POOL_HOSTS.some((h) => !!process.env[h.env]),
  };
}

/** Model cost in US dollars for one reply. Gemini and the NVIDIA-hosted models run on free tiers for now, so they're 0. */
export function replyCostUsd(modelId: string, inputTokens: number, outputTokens: number): number {
  const c = CLAUDE[modelId] ?? GROK[modelId] ?? DEEPSEEK[modelId] ?? (modelId === "gemini-argo" ? argoPrice() : null);
  return c ? (inputTokens * c.usdIn + outputTokens * c.usdOut) / 1e6 : 0;
}

/** Longest reply per tool. Code and designs need room for whole files; chat answers stay readable. */
export const MAX_OUTPUT: Record<Extract<ToolId, "chat" | "code" | "design">, number> = { chat: 8000, code: 16000, design: 32000 };

// ---------------------------------------------------------------- Google

let geminiPick: { models: string[]; at: number } | null = null;

/** Fallbacks every key can use, tried last. */
const GEMINI_FALLBACKS = ["gemini-flash-latest", "gemini-2.5-flash"];

/** Plain Flash models, best first: newest stable ones, then one preview, then the fallbacks. */
export function flashOrder(names: string[]): string[] {
  const version = (n: string) => {
    const [major, minor = "0"] = n.slice(7).split("-")[0].split(".");
    return Number(major) * 1000 + Number(minor);
  };
  const flash = names
    .filter((n) => /^gemini-\d+(\.\d+)?-flash(-[\w-]+)?$/.test(n) && !/lite|image|tts|live|audio|exp|thinking|8b/.test(n))
    .sort((a, b) => version(b) - version(a) || a.length - b.length);
  const stable = flash.filter((n) => /-flash(-\d{3})?$/.test(n));
  const preview = flash.filter((n) => !stable.includes(n));
  // Flash-Lite has a free quota of its own: the last resort when the Flash ones are used up.
  const lite = names.filter((n) => /^gemini-\d+(\.\d+)?-flash-lite$/.test(n)).sort((a, b) => version(b) - version(a));
  return [...new Set([...stable.slice(0, 2), ...preview.slice(0, 1), ...GEMINI_FALLBACKS, ...lite.slice(0, 1), "gemini-flash-lite-latest"])];
}

/**
 * Flash models to try for this key, checked at most once an hour. GEMINI_MODEL pins the first
 * choice; the others stay as fallbacks.
 */
export async function geminiModels(key: string): Promise<string[]> {
  const pinned = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : [];
  if (!geminiPick || Date.now() - geminiPick.at > 3600_000) {
    let models = GEMINI_FALLBACKS;
    try {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": key } });
      if (!r.ok) console.error("gemini models list failed", r.status);
      if (r.ok) {
        const { models: list = [] } = (await r.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
        models = flashOrder(list.filter((m) => m.supportedGenerationMethods?.includes("generateContent")).map((m) => m.name.replace(/^models\//, "")));
      }
    } catch {}
    geminiPick = { models, at: Date.now() };
  }
  return [...new Set([...pinned, ...geminiPick.models])];
}

/** Models resting after a timeout or overload, until this time. */
const resting = new Map<string, number>();

/**
 * Gemini keys: GEMINI_API_KEY plus any in GEMINI_API_KEYS (comma-separated). On the free tier
 * each Google Cloud project has its own daily quota, so keys from different projects add up.
 */
export function geminiKeys(): string[] {
  const all = [process.env.GEMINI_API_KEY, ...(process.env.GEMINI_API_KEYS ?? "").split(/[\s,]+/)];
  return [...new Set(all.map((k) => k?.trim() ?? "").filter(Boolean))];
}

/** Key-and-model pairs whose quota is used up, until it resets (Google says when). */
const spent = new Map<string, number>();

type GeminiTry = { key: string; model: string; slot: string };

/**
 * What to try, best first: each model on each key, leaving out pairs whose quota is spent and
 * putting overloaded models last.
 */
async function geminiTries(limit: number): Promise<GeminiTry[]> {
  const keys = geminiKeys();
  if (!keys.length) return [];
  const now = Date.now();
  const models = await geminiModels(keys[0]);
  const all = models.flatMap((model) => keys.map((key, k) => ({ key, model, slot: `${k}:${model}` })));
  const open = all.filter((t) => (spent.get(t.slot) ?? 0) <= now);
  return [...open.filter((t) => (resting.get(t.model) ?? 0) <= now), ...open.filter((t) => (resting.get(t.model) ?? 0) > now)].slice(0, limit);
}

/**
 * A 429 that means the quota is used up (not a short burst): marks the pair spent until Google's
 * retry time, along with the model the quota belongs to ("gemini-flash-latest" counts against
 * the Flash it points at). Returns whether it was one.
 */
function noteQuota(t: GeminiTry, raw: string): boolean {
  const delay = raw.match(/"retryDelay":\s*"([\d.]+)s"/)?.[1];
  const said = raw.match(/retry in (?:(\d+)h)?(?:(\d+)m)?([\d.]+)s/i);
  const secs = delay ? Number(delay) : said ? Number(said[1] ?? 0) * 3600 + Number(said[2] ?? 0) * 60 + Number(said[3]) : 0;
  // The per-minute and per-day limits share a metric name; only the quota id says which.
  const daily = /PerDay/i.test(raw);
  if (secs < 90 && !daily) return false;
  const until = Date.now() + Math.min(Math.max(secs, 600), 24 * 3600) * 1000;
  spent.set(t.slot, until);
  const real = raw.match(/model:\s*([\w.-]+)/)?.[1];
  const k = t.slot.split(":")[0];
  if (real && real !== t.model) spent.set(`${k}:${real}`, until);
  // An alias and the model it names share a quota: once one is spent, so is the other.
  for (const alias of ["gemini-flash-latest", "gemini-flash-lite-latest"]) if (real && geminiAlias.get(alias) === real) spent.set(`${k}:${alias}`, until);
  if (t.model.endsWith("-latest") && real) geminiAlias.set(t.model, real);
  return true;
}
/** Which model each "-latest" alias turned out to be, learnt from quota errors. */
const geminiAlias = new Map<string, string>();

/** Whether any free host besides Gemini has a key (for when Gemini's quota is used up). */
const hasPool = () => POOL_HOSTS.some((h) => !!process.env[h.env]);

/** Google's "too busy" answers: worth another try, or another model. */
// 502 and the 52x codes are Google's gateway timing out or failing on a slow model: try another.
const RETRYABLE = new Set([429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 529]);

const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), reject(signal.reason)), { once: true });
  });

/**
 * How long a Gemini model thinks before answering. Left unset, the newest Flash models think at
 * length on every message (a simple question took minutes), so chat asks for the least thinking
 * and code and design for a little. Gemini 2.x counts it in tokens, Gemini 3 and later in levels.
 */
function geminiThinking(model: string, fast: boolean) {
  const major = Number(model.match(/^gemini-(\d+)/)?.[1] ?? 0);
  if (major >= 3) return { thinkingLevel: fast ? "minimal" : "low" };
  if (major === 2) return { thinkingBudget: fast ? 0 : 1024 };
  // Aliases like "gemini-flash-latest" give no version: cap thinking anyway (Gemini counts it
  // against the reply's length limit, and a big attachment can make it think the whole limit away).
  // A model that won't take this answers 400 and is asked again without it.
  return { thinkingBudget: fast ? 512 : 2048 };
}

/**
 * Gemini Argo: one specific Google model, named exactly as Google lists it, in GEMINI_ARGO_MODEL
 * (e.g. "gemini-argo-preview"). It uses GEMINI_ARGO_KEY when set (a paid key, say), otherwise the
 * Gemini keys. Optional GEMINI_ARGO_PRICE ("1.25,10": US$ per million input and output tokens)
 * lets Admin count what it costs.
 */
export function argoModel(): string {
  return (process.env.GEMINI_ARGO_MODEL ?? "").trim().replace(/^models\//, "");
}
function argoKeys(): string[] {
  const own = (process.env.GEMINI_ARGO_KEY ?? "").trim();
  return own ? [own] : geminiKeys();
}
function argoPrice(): { usdIn: number; usdOut: number } | null {
  const [i, o] = (process.env.GEMINI_ARGO_PRICE ?? "").split(",").map(Number);
  return i >= 0 && o >= 0 && (i || o) ? { usdIn: i, usdOut: o } : null;
}

async function* gemini(system: string, turns: Turn[], maxTokens: number, signal: AbortSignal, fast = true, pinned?: string, noThinking = false): AsyncGenerator<ReplyEvent> {
  const request = (model: string, thinking: boolean) => {
    const t = thinking && !noThinking ? geminiThinking(model, fast) : null;
    const off = noThinking && /^gemini-(2\.5|flash)/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {};
    return JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: turns.map((t) => ({
        role: t.role === "assistant" ? "model" : "user",
        parts: [...(t.files ?? []).map((f) => ({ inlineData: { mimeType: f.mime, data: f.data } })), { text: t.text }],
      })),
      generationConfig: { maxOutputTokens: maxTokens, ...(t ? { thinkingConfig: t } : off) },
    });
  };
  // A busy model gets one more try after a pause, then the next model (or key) is tried. All of
  // this happens before any words arrive, so the person only sees a slightly longer wait.
  // Models that recently timed out or were overloaded go to the back of the line for a while;
  // ones whose quota is used up are skipped until it resets.
  // A pinned model (Gemini Argo) is tried on each of its keys only: never swapped for Flash.
  const options = pinned ? argoKeys().map((key, k) => ({ key, model: pinned, slot: `argo${k}:${pinned}` })) : await geminiTries(5);
  const tries = options.length ? [options[0], ...options].slice(0, 5) : [];
  let res: Response | null = null;
  let error: ProviderError | null = null;
  for (let i = 0; i < tries.length && !res; i++) {
    const { model, key } = tries[i];
    if (i > 0) await pause(i === 1 ? 1200 : 300, signal);
    const call = (thinking: boolean) =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: request(model, thinking),
      });
    let r = await call(true);
    // A model that doesn't take this thinking setting answers 400: ask again without it.
    if (r.status === 400 && geminiThinking(model, fast)) r = await call(false);
    if (r.ok && r.body) {
      res = r;
      break;
    }
    const raw = await r.text().catch(() => "");
    let message = raw.slice(0, 300);
    try {
      message = (JSON.parse(raw) as { error?: { message?: string } }).error?.message ?? message;
    } catch {}
    console.error("gemini error", model, r.status, message);
    // Quota used up: no point trying this pair again (not even the second try).
    if (r.status === 429 && noteQuota(tries[i], raw) && tries[i + 1] === tries[i]) i++;
    // 402/403: billing or key problems on Wanlly's side, not something the person can retry.
    const kind = RETRYABLE.has(r.status) ? "busy" : r.status === 402 || r.status === 403 ? "unavailable" : "failed";
    error = new ProviderError(kind, `Google ${r.status} on ${model}: ${message}${i ? ` (try ${i + 1})` : ""}`);
    // Busy models and ones this key can't use (404) move on to the next; anything else stops.
    if (!RETRYABLE.has(r.status) && r.status !== 404) break;
    if (r.status === 404 && tries[i + 1] === tries[i]) i++;
    // Overloaded or timed out: rest this model for 10 minutes. A timeout already took long, so
    // don't wait on the same model again; go straight to the next one.
    if (r.status === 503 || r.status >= 520) {
      resting.set(model, Date.now() + 10 * 60_000);
      if (r.status >= 520 && tries[i + 1] === tries[i]) i++;
    }
  }
  if (!res?.body) {
    // Gemini is used up or busy: the other free hosts take it, when there are any.
    if (!pinned && !signal.aborted && hasPool() && !turns.some((t) => t.files?.length)) return yield* pool(system, turns, maxTokens, signal, false);
    throw error ?? new ProviderError(tries.length ? "failed" : "busy", tries.length ? "" : "Every Gemini key has used today's free quota");
  }
  let inputTokens = 0;
  let outputTokens = 0;
  let stop = "end";
  let wrote = false;
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const chunk = JSON.parse(line.slice(5)) as {
        candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
        promptFeedback?: { blockReason?: string };
      };
      if (chunk.promptFeedback?.blockReason) stop = "refusal";
      const cand = chunk.candidates?.[0];
      for (const part of cand?.content?.parts ?? [])
        if (part.text && !part.thought) {
          wrote = true;
          yield { type: "text", text: part.text };
        }
      if (cand?.finishReason) stop = cand.finishReason === "MAX_TOKENS" ? "max_tokens" : cand.finishReason === "STOP" ? "end" : "refusal";
      if (chunk.usageMetadata) {
        inputTokens = chunk.usageMetadata.promptTokenCount ?? inputTokens;
        outputTokens = (chunk.usageMetadata.candidatesTokenCount ?? 0) + (chunk.usageMetadata.thoughtsTokenCount ?? 0) || outputTokens;
      }
    }
  }
  // It thought until the limit and wrote nothing: once more, without thinking, before anyone
  // sees "hit its length limit" on an empty reply.
  if (!wrote && stop === "max_tokens" && !noThinking && !signal.aborted) return yield* gemini(system, turns, maxTokens, signal, fast, pinned, true);
  yield { type: "done", inputTokens, outputTokens, stop };
}

// ---------------------------------------------------------------- Google images

let imagePick: { models: string[]; at: number } | null = null;
const IMAGE_FALLBACKS = ["gemini-2.5-flash-image", "gemini-2.0-flash-preview-image-generation"];

/** Gemini models that draw pictures (Flash first: cheaper and faster), checked once an hour. */
export async function geminiImageModels(key: string): Promise<string[]> {
  if (process.env.GEMINI_IMAGE_MODEL) return [process.env.GEMINI_IMAGE_MODEL, ...IMAGE_FALLBACKS];
  if (imagePick && Date.now() - imagePick.at < 3600_000) return imagePick.models;
  let models = IMAGE_FALLBACKS;
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": key } });
    if (r.ok) {
      const { models: list = [] } = (await r.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
      const found = list
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => m.name.replace(/^models\//, ""))
        .filter((n) => /^gemini-[\d.]+-(flash|pro)(-preview)?-image/.test(n) && !/tts|live/.test(n))
        .sort((a, b) => Number(b.includes("flash")) - Number(a.includes("flash")) || parseFloat(b.slice(7)) - parseFloat(a.slice(7)));
      models = [...new Set([...found.slice(0, 3), ...IMAGE_FALLBACKS])];
    }
  } catch {}
  imagePick = { models, at: Date.now() };
  return models;
}

/**
 * Asks Gemini for one picture. Returns the model's raw response, unread: an image response is
 * several MB, and reading it here would cost more CPU than a Worker has. Busy or unavailable
 * models are skipped for the next one.
 */
export async function requestImage(prompt: string, files: { mime: string; data: string }[], signal: AbortSignal): Promise<{ res: Response; model: string }> {
  const key = geminiKeys()[0];
  if (!key) throw new ProviderError("unavailable");
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [...files.map((f) => ({ inlineData: { mimeType: f.mime, data: f.data } })), { text: prompt }] }],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
  });
  let error: ProviderError | null = null;
  for (const model of (await geminiImageModels(key)).slice(0, 4)) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body,
    });
    if (res.ok && res.body) return { res, model };
    const raw = await res.text().catch(() => "");
    let message = raw.slice(0, 300);
    try {
      message = (JSON.parse(raw) as { error?: { message?: string } }).error?.message ?? message;
    } catch {}
    console.error("gemini image error", model, res.status, message);
    // A quota of 0 means this key's plan has no image generation (free tier): a billing matter.
    const kind = /limit: 0|billing|prepayment/i.test(message) || res.status === 402 || res.status === 403 ? "unavailable" : RETRYABLE.has(res.status) ? "busy" : "failed";
    error = new ProviderError(kind, `Google ${res.status} on ${model}: ${message}`);
    if (!RETRYABLE.has(res.status) && res.status !== 404 && res.status !== 400) break;
  }
  throw error ?? new ProviderError("failed");
}

// ---------------------------------------------------------------- Anthropic

let anthropic: Anthropic | null = null;

async function* claude(modelId: string, tool: ToolId, system: string, turns: Turn[], maxTokens: number, signal: AbortSignal): AsyncGenerator<ReplyEvent> {
  anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1 });
  const m = CLAUDE[modelId];
  // Sonnet, Opus and Fable can decline in rare safety cases; the default fallback lets
  // another model finish the reply instead of stopping.
  const stream = anthropic.beta.messages.stream(
    {
      model: m.api,
      max_tokens: maxTokens,
      system,
      messages: turns.map((t) =>
        t.files?.length
          ? {
              role: t.role,
              content: [
                ...t.files.map((f) =>
                  f.mime === "application/pdf"
                    ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data } } as const)
                    : ({ type: "image", source: { type: "base64", media_type: f.mime as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: f.data } } as const),
                ),
                { type: "text" as const, text: t.text },
              ],
            }
          : { role: t.role, content: t.text },
      ),
      output_config: { effort: tool === "chat" ? "low" : "medium" },
      // Cache the prompt so the next request re-reads it at a fraction of the price: always for
      // code and design (long instructions, "continue" rounds), and for chats with history.
      ...(tool !== "chat" || turns.length > 2 ? { cache_control: { type: "ephemeral" as const } } : {}),
      ...(m.fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    },
    { signal },
  );
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield { type: "text", text: event.delta.text };
  }
  const final = await stream.finalMessage();
  const stop = final.stop_reason === "refusal" ? "refusal" : final.stop_reason === "max_tokens" ? "max_tokens" : "end";
  yield { type: "done", inputTokens: billedInput(modelId, final.usage), outputTokens: final.usage.output_tokens, stop };
}

/** Whether a catalog model runs on Claude, which the Builder needs for its file-editing tool. */
export const isClaudeModel = (modelId: string) => !!CLAUDE[modelId];

/**
 * One Builder step: Claude reads the conversation so far and either replies or edits files with
 * the text editor tool. Text streams to `onText`; the finished message (with its tool calls) is
 * returned along with the billed input (cache reads at their discount). The prompt is cached, so
 * each step re-reads the growing conversation at a fraction of the price.
 */
export async function claudeBuildStep(opts: {
  modelId: string;
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  signal: AbortSignal;
  onText: (text: string) => void;
}) {
  if (!process.env.ANTHROPIC_API_KEY) throw new ProviderError("unavailable");
  anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1 });
  const m = CLAUDE[opts.modelId];
  if (!m) throw new ProviderError("unavailable");
  const stream = anthropic.beta.messages.stream(
    {
      model: m.api,
      max_tokens: 32000,
      system: opts.system,
      messages: forClaude(opts.messages),
      tools: [{ type: "text_editor_20250728", name: "str_replace_based_edit_tool", max_characters: 40000 }, GITHUB_TOOL],
      output_config: { effort: "medium" },
      cache_control: { type: "ephemeral" },
    },
    { signal: opts.signal },
  );
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") opts.onText(event.delta.text);
  }
  const message = await stream.finalMessage();
  return { message, inputTokens: billedInput(opts.modelId, message.usage), outputTokens: message.usage.output_tokens };
}

/** Builder history without the notes kept for Gemini (Claude refuses fields it doesn't know). */
function forClaude(messages: Anthropic.Beta.BetaMessageParam[]): Anthropic.Beta.BetaMessageParam[] {
  return messages.map((m) => {
    if (typeof m.content === "string") return m;
    const content = m.content.map((b) => {
      if (!("gemini_signature" in b)) return b;
      const copy = { ...b } as Record<string, unknown>;
      delete copy.gemini_signature;
      return copy;
    });
    return { ...m, content: content as typeof m.content };
  });
}

/*
 * The Builder on Gemini. Gemini gets the same file tool Claude has (described as a function),
 * and its turns are saved in the same shape as Claude's, so one project can move between the two.
 * Gemini signs its function calls; the signature is kept with the saved call and sent back with
 * it, as Gemini requires. Calls made by Claude have none, and are marked as such.
 */
type BuildBlock = { type: string; text?: string; id?: string; name?: string; input?: unknown; tool_use_id?: string; content?: unknown; is_error?: boolean; gemini_signature?: string };

const EDIT_TOOL = {
  name: "str_replace_based_edit_tool",
  description:
    'Work on the project\'s files. command "view": a file\'s numbered lines, or the list of files when path is "/" or a folder. "create": write a whole file (file_text). "str_replace": replace one exact, unique passage (old_str) with new_str. "insert": add insert_text after line insert_line (0 for the top).',
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", enum: ["view", "create", "str_replace", "insert"] },
      path: { type: "string", description: 'Path inside the project, like "index.html" or "src/app.js"; "/" for all files.' },
      file_text: { type: "string" },
      old_str: { type: "string" },
      new_str: { type: "string" },
      insert_line: { type: "integer" },
      insert_text: { type: "string" },
      view_range: { type: "array", items: { type: "integer" }, description: "Optional [first, last] line numbers; -1 for the end." },
    },
    required: ["command", "path"],
  },
};
/** Google's documented marker for a function call that has no signature of its own. */
const NO_SIGNATURE = "skip_thought_signature_validator";

function toGeminiContents(messages: Anthropic.Beta.BetaMessageParam[]) {
  const names = new Map<string, string>();
  return messages.map((m) => {
    const blocks = (typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content) as BuildBlock[];
    const parts: Record<string, unknown>[] = [];
    for (const b of blocks) {
      if (b.type === "text" && b.text) parts.push({ text: b.text, ...(b.gemini_signature ? { thoughtSignature: b.gemini_signature } : {}) });
      else if (b.type === "tool_use" && b.id) {
        names.set(b.id, b.name ?? EDIT_TOOL.name);
        parts.push({ functionCall: { name: b.name ?? EDIT_TOOL.name, args: b.input ?? {} }, thoughtSignature: b.gemini_signature ?? NO_SIGNATURE });
      } else if (b.type === "tool_result") {
        const text = typeof b.content === "string" ? b.content : Array.isArray(b.content) ? (b.content as { text?: string }[]).map((c) => c.text ?? "").join("\n") : "";
        parts.push({ functionResponse: { name: names.get(b.tool_use_id ?? "") ?? EDIT_TOOL.name, response: b.is_error ? { error: text } : { output: text } } });
      }
    }
    return { role: m.role === "assistant" ? "model" : "user", parts: parts.length ? parts : [{ text: "(continue)" }] };
  });
}

export async function geminiBuildStep(opts: { system: string; messages: Anthropic.Beta.BetaMessageParam[]; signal: AbortSignal; onText: (text: string) => void; retry?: boolean }): Promise<{
  message: { content: Anthropic.Beta.BetaContentBlock[]; stop_reason: string };
  inputTokens: number;
  outputTokens: number;
}> {
  if (!geminiKeys().length) throw new ProviderError("unavailable");
  const body = (model: string, thinking: boolean) => {
    const t = thinking && !opts.retry ? geminiThinking(model, false) : null;
    return JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: toGeminiContents(opts.messages),
      tools: [{ functionDeclarations: [EDIT_TOOL, { name: GITHUB_TOOL.name, description: GITHUB_TOOL.description, parameters: GITHUB_TOOL.input_schema }] }],
      generationConfig: { maxOutputTokens: 32000, ...(t ? { thinkingConfig: t } : {}) },
    });
  };
  // Like chat: a busy, missing or used-up model moves on to the next one before anything is shown.
  const tries = await geminiTries(4);
  let res: Response | null = null;
  let error: ProviderError | null = null;
  for (let i = 0; i < tries.length && !res; i++) {
    const { model, key } = tries[i];
    if (i > 0) await pause(800, opts.signal);
    const call = (thinking: boolean) =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
        method: "POST",
        signal: opts.signal,
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: body(model, thinking),
      });
    let r = await call(true);
    if (r.status === 400 && geminiThinking(model, false)) r = await call(false);
    if (r.ok && r.body) {
      res = r;
      break;
    }
    const raw = await r.text().catch(() => "");
    console.error("gemini build error", model, r.status, raw.slice(0, 300));
    if (r.status === 429) noteQuota(tries[i], raw);
    error = new ProviderError(RETRYABLE.has(r.status) ? "busy" : r.status === 402 || r.status === 403 ? "unavailable" : "failed", `Google ${r.status} on ${model}`);
    if (!RETRYABLE.has(r.status) && r.status !== 404) break;
    if (r.status === 503 || r.status >= 520) resting.set(model, Date.now() + 10 * 60_000);
  }
  if (!res?.body) {
    // Gemini is used up or busy: another free host carries on with the same tools.
    if (!opts.signal.aborted && hasPool()) return openBuildStep(opts);
    throw error ?? new ProviderError("busy", "Every Gemini key has used today's free quota");
  }

  const content: BuildBlock[] = [];
  let finish = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let blocked = false;
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const chunk = JSON.parse(line.slice(5)) as {
        candidates?: { content?: { parts?: { text?: string; thought?: boolean; thoughtSignature?: string; functionCall?: { name: string; args?: unknown } }[] }; finishReason?: string }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
        promptFeedback?: { blockReason?: string };
      };
      if (chunk.promptFeedback?.blockReason) blocked = true;
      const cand = chunk.candidates?.[0];
      if (cand?.finishReason) finish = cand.finishReason;
      for (const part of cand?.content?.parts ?? []) {
        if (part.thought) continue;
        if (part.functionCall) {
          content.push({ type: "tool_use", id: `toolu_g${crypto.randomUUID().replace(/-/g, "").slice(0, 22)}`, name: part.functionCall.name, input: part.functionCall.args ?? {}, ...(part.thoughtSignature ? { gemini_signature: part.thoughtSignature } : {}) });
        } else if (part.text !== undefined || part.thoughtSignature) {
          const last = content[content.length - 1];
          const block = last?.type === "text" ? last : (content.push({ type: "text", text: "" }), content[content.length - 1]);
          if (part.text) {
            block.text += part.text;
            opts.onText(part.text);
          }
          if (part.thoughtSignature) block.gemini_signature = part.thoughtSignature;
        }
      }
      if (chunk.usageMetadata) {
        inputTokens = chunk.usageMetadata.promptTokenCount ?? inputTokens;
        outputTokens = (chunk.usageMetadata.candidatesTokenCount ?? 0) + (chunk.usageMetadata.thoughtsTokenCount ?? 0) || outputTokens;
      }
    }
  }
  const tidy = content.filter((b) => b.type !== "text" || b.text?.trim());
  // Gemini sometimes ends a turn with nothing to show (all its output was thinking). That would
  // stop the build silently, so it gets one more try, without thinking.
  if (!tidy.length && !blocked && finish !== "MAX_TOKENS" && !opts.retry) {
    const again = await geminiBuildStep({ ...opts, retry: true });
    return { ...again, inputTokens: again.inputTokens + inputTokens, outputTokens: again.outputTokens + outputTokens };
  }
  const stop_reason = blocked || /SAFETY|PROHIBITED|BLOCKLIST|RECITATION/.test(finish) ? "refusal" : finish === "MAX_TOKENS" ? "max_tokens" : tidy.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn";
  return { message: { content: tidy as unknown as Anthropic.Beta.BetaContentBlock[], stop_reason }, inputTokens, outputTokens };
}

/**
 * A Builder step on a free OpenAI-compatible host (Cerebras, Groq, NVIDIA, Mistral, OpenRouter),
 * with the same tools, for when Gemini's quota is used up. The conversation is kept in Anthropic's
 * shape and translated each way, so the next step can go back to Gemini or Claude.
 */
async function openBuildStep(opts: {
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  signal: AbortSignal;
  onText: (text: string) => void;
  /** One chosen host and model (e.g. Kimi on NVIDIA) instead of the free pool. */
  only?: { id: string; host: Host; label: string; model: string };
}): Promise<{
  message: { content: Anthropic.Beta.BetaContentBlock[]; stop_reason: string };
  inputTokens: number;
  outputTokens: number;
}> {
  const messages: Record<string, unknown>[] = [{ role: "system", content: opts.system }];
  for (const m of opts.messages) {
    const blocks = (typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content) as BuildBlock[];
    const text = blocks
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n");
    if (m.role === "assistant") {
      const calls = blocks.filter((b) => b.type === "tool_use" && b.id).map((b) => ({ id: b.id, type: "function", function: { name: b.name ?? EDIT_TOOL.name, arguments: JSON.stringify(b.input ?? {}) } }));
      messages.push({ role: "assistant", content: text || null, ...(calls.length ? { tool_calls: calls } : {}) });
    } else {
      // Tool results answer the calls just before them, so they come first.
      for (const b of blocks.filter((b) => b.type === "tool_result")) {
        const out = typeof b.content === "string" ? b.content : Array.isArray(b.content) ? (b.content as { text?: string }[]).map((c) => c.text ?? "").join("\n") : "";
        messages.push({ role: "tool", tool_call_id: b.tool_use_id, content: b.is_error ? `Error: ${out}` : out || "(done)" });
      }
      if (text) messages.push({ role: "user", content: text });
    }
  }
  const tools = [EDIT_TOOL, { name: GITHUB_TOOL.name, description: GITHUB_TOOL.description, parameters: GITHUB_TOOL.input_schema }].map((f) => ({ type: "function", function: f }));
  const tried: string[] = [];
  for (const c of opts.only ? [opts.only] : (await poolPlan()).filter((c) => !c.resting).slice(0, 4)) {
    const r = await fetch(`${c.host.base}/chat/completions`, {
      method: "POST",
      signal: opts.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${c.host.key}`, accept: "text/event-stream" },
      body: JSON.stringify({ model: c.model, messages, tools, max_tokens: 8192, stream: true, stream_options: { include_usage: true } }),
    }).catch((e) => {
      if (opts.signal.aborted) throw e;
      return null;
    });
    if (!r?.ok || !r.body) {
      const raw = r ? await r.text().catch(() => "") : "no answer";
      console.error(`${c.label} build error`, c.model, r?.status, raw.slice(0, 300));
      resting.set(c.id, Date.now() + 10 * 60_000);
      tried.push(`${c.label} ${c.model}: ${r?.status ?? ""}`);
      continue;
    }
    let text = "";
    let finish = "";
    let inputTokens = 0;
    let outputTokens = 0;
    const calls: { id: string; name: string; args: string }[] = [];
    const strip = thinkFilter();
    const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        let chunk: {
          choices?: { delta?: { content?: string | null; tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[] }; finish_reason?: string | null }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
        };
        try {
          chunk = JSON.parse(data);
        } catch {
          continue;
        }
        const choice = chunk.choices?.[0];
        const piece = choice?.delta?.content ? strip(choice.delta.content) : "";
        if (piece) {
          text += piece;
          opts.onText(piece);
        }
        for (const tc of choice?.delta?.tool_calls ?? []) {
          const at = tc.index ?? (tc.id || !calls.length ? calls.length : calls.length - 1);
          // Our own id: some hosts' ids (e.g. "functions.name:0") aren't valid for Claude later.
          calls[at] ??= { id: `toolu_o${crypto.randomUUID().replace(/-/g, "").slice(0, 22)}`, name: "", args: "" };
          if (tc.function?.name) calls[at].name += tc.function.name;
          if (tc.function?.arguments) calls[at].args += tc.function.arguments;
        }
        if (choice?.finish_reason) finish = choice.finish_reason;
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens ?? inputTokens;
          outputTokens = chunk.usage.completion_tokens ?? outputTokens;
        }
      }
    }
    const content: BuildBlock[] = [];
    if (text.trim()) content.push({ type: "text", text });
    for (const call of calls.filter(Boolean)) {
      let input: unknown = {};
      try {
        input = JSON.parse(call.args || "{}");
      } catch {}
      content.push({ type: "tool_use", id: call.id, name: call.name || EDIT_TOOL.name, input });
    }
    if (!outputTokens) outputTokens = Math.ceil((text.length + calls.reduce((n, c) => n + c.args.length, 0)) / 4);
    if (!inputTokens) inputTokens = Math.ceil(JSON.stringify(messages).length / 4);
    const stop_reason = finish === "content_filter" ? "refusal" : finish === "length" ? "max_tokens" : content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn";
    return { message: { content: content as unknown as Anthropic.Beta.BetaContentBlock[], stop_reason }, inputTokens, outputTokens };
  }
  throw new ProviderError("busy", opts.only ? `${opts.only.label} ${opts.only.model} didn't answer: ${tried.join(" · ")}` : `Gemini's free quota is used up and every other free host was busy: ${tried.join(" · ") || "none set"}`);
}

/** A Builder step on one of the open models hosted by NVIDIA (Kimi, GLM, DeepSeek), on Wanlly's NVIDIA key. */
export async function nvidiaBuildStep(opts: { modelId: string; system: string; messages: Anthropic.Beta.BetaMessageParam[]; signal: AbortSignal; onText: (text: string) => void }) {
  if (!process.env.NVIDIA_API_KEY) throw new ProviderError("unavailable");
  const model = await nvidiaModel(opts.modelId);
  return openBuildStep({ ...opts, only: { id: `nvidia:${model}`, host: nvidiaHost(), label: "NVIDIA", model } });
}

/**
 * Checks a Builder project in Anthropic's code sandbox: the project goes up as a zip, Claude
 * unpacks it, installs what it can, runs the build and tests, and reports without changing
 * anything. The upload is deleted afterwards.
 */
const PROMPT_CHECK =
  "project.zip holds a web project someone is building. Unzip it into a fresh folder and check it, without changing any file:\n1. Look at what kind of project it is.\n2. If there's a package.json or requirements.txt, try to install dependencies. The sandbox may have no internet; if installs fail, say so and do what you can without them.\n3. Run its build and its tests if it has them. Otherwise run syntax checks (node --check on .js files, python -m py_compile on .py files) and look for obvious broken references (missing files, scripts or stylesheets that don't exist).\n4. Reply with a short report: what you ran, what passed, and for each failure the exact error lines and the likely cause. No other commentary.";

export async function claudeSandboxCheck(opts: { modelId: string; zip: Blob; signal: AbortSignal }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new ProviderError("unavailable");
  anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1 });
  const m = CLAUDE[opts.modelId];
  if (!m) throw new ProviderError("unavailable");
  const uploaded = await anthropic.files.upload({ file: await toFile(opts.zip, "project.zip", { type: "application/zip" }) });
  try {
    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: PROMPT_CHECK,
          },
          { type: "container_upload", file_id: uploaded.id },
        ],
      },
    ];
    // Long installs or builds can pause the turn; it's resumed (a few times at most) by sending
    // the conversation back, in the same sandbox.
    let inputTokens = 0;
    let outputTokens = 0;
    let message: Anthropic.Message | null = null;
    let container: string | undefined;
    for (let round = 0; round < 4; round++) {
      const stream: ReturnType<Anthropic["messages"]["stream"]> = anthropic.messages.stream(
        {
          model: m.api,
          max_tokens: 16000,
          tools: [{ type: "code_execution_20260521", name: "code_execution" }],
          output_config: { effort: "low" },
          ...(container ? { container } : {}),
          messages,
        },
        { signal: opts.signal },
      );
      const reply: Anthropic.Message = await stream.finalMessage();
      message = reply;
      container = reply.container?.id ?? container;
      inputTokens += billedInput(opts.modelId, reply.usage);
      outputTokens += reply.usage.output_tokens;
      if (reply.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: reply.content });
    }
    const report = (message?.content ?? [])
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { report, inputTokens, outputTokens };
  } finally {
    await anthropic.files.delete(uploaded.id).catch(() => {});
  }
}

// ---------------------------------------------------------------- NVIDIA (open models)

/*
 * Open models hosted by NVIDIA (build.nvidia.com), through its OpenAI-compatible API. Catalog ids
 * are written slightly differently in different places, so each model lists the spellings it may
 * have and the live list picks the one NVIDIA serves. NVIDIA_BASE_URL can point the same models
 * at another OpenAI-compatible host (a paid NIM endpoint, or the makers' own APIs) later.
 */
const NVIDIA: Record<string, string[]> = {
  "deepseek-flash": ["deepseek-ai/deepseek-v4.1-flash", "deepseek-ai/deepseek-v4-1-flash", "deepseek-ai/deepseek-v4-flash"],
  glm: ["z-ai/glm-5.3", "z-ai/glm-5-3", "zai-org/glm-5.3"],
  "glm-flash": ["z-ai/glm-5.3-flash", "z-ai/glm-5-3-flash", "zai-org/glm-5.3-flash"],
  // NVIDIA retired Kimi K3 on 15 Oct 2026; K2.6 is what it serves now.
  kimi: ["moonshotai/kimi-k2.6", "moonshotai/kimi-k3", "moonshotai/kimi-k3-instruct"],
};

/** When NVIDIA retires or renames a model, the newest one it serves from the same family stands in. */
const NVIDIA_FAMILY: Record<string, RegExp> = {
  "deepseek-flash": /^deepseek-ai\/deepseek-v[\d.-]+-flash$/,
  glm: /^z-ai\/glm-[\d.-]+$/,
  "glm-flash": /^z-ai\/glm-[\d.-]+-flash$/,
  kimi: /^moonshotai\/kimi-k[\d.-]+$/,
};

const nvidiaBase = () => (process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, "");
let nvidiaList: { ids: Set<string>; at: number } | null = null;

/** The id NVIDIA serves for one of our models, from its model list (checked at most once an hour). */
export async function nvidiaModel(modelId: string): Promise<string> {
  const names = NVIDIA[modelId];
  if (!nvidiaList || Date.now() - nvidiaList.at > 3600_000) {
    let ids = new Set<string>();
    try {
      const r = await fetch(`${nvidiaBase()}/models`, { headers: { authorization: `Bearer ${process.env.NVIDIA_API_KEY}` } });
      if (r.ok) ids = new Set(((await r.json()) as { data?: { id: string }[] }).data?.map((m) => m.id) ?? []);
      else console.error("nvidia models list failed", r.status);
    } catch {}
    nvidiaList = { ids, at: Date.now() };
  }
  const exact = names.find((n) => nvidiaList!.ids.has(n));
  if (exact) return exact;
  const family = NVIDIA_FAMILY[modelId];
  const stand = family ? [...nvidiaList.ids].filter((id) => family.test(id)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0] : undefined;
  return stand ?? names[0];
}

/** Removes <think>…</think> from a stream of text pieces, for models that think out loud in their answer. */
function thinkFilter() {
  let inside = false;
  let carry = "";
  return (piece: string): string => {
    let s = carry + piece;
    carry = "";
    let out = "";
    while (s) {
      const tag = inside ? "</think>" : "<think>";
      const i = s.indexOf(tag);
      if (i >= 0) {
        if (!inside) out += s.slice(0, i);
        s = s.slice(i + tag.length);
        inside = !inside;
        continue;
      }
      // Keep a possible half tag at the end for the next piece.
      const keep = [...Array(tag.length - 1).keys()].map((k) => k + 1).reverse().find((k) => s.endsWith(tag.slice(0, k))) ?? 0;
      if (!inside) out += s.slice(0, s.length - keep);
      carry = s.slice(s.length - keep);
      break;
    }
    return out;
  };
}

// ---------------------------------------------------------------- xAI (Grok)

/** Grok models: API id and US dollars per million tokens (input, output), for prompts under 200K tokens. */
const GROK: Record<string, { api: string; usdIn: number; usdOut: number }> = {
  grok: { api: "grok-4.3", usdIn: 1.25, usdOut: 2.5 },
  "grok-top": { api: "grok-4.7", usdIn: 2, usdOut: 6 },
};

// ---------------------------------------------------------------- DeepSeek (direct)

/**
 * DeepSeek's own API: paid, but cheap. Ids to try in order (the newest name first), and US
 * dollars per million tokens; Pro uses its standard price, not a promotion.
 */
const DEEPSEEK: Record<string, { api: string[]; usdIn: number; usdOut: number }> = {
  deepseek: { api: ["deepseek-v4-flash", "deepseek-chat"], usdIn: 0.14, usdOut: 0.28 },
  "deepseek-pro": { api: ["deepseek-v4-pro", "deepseek-reasoner"], usdIn: 1.74, usdOut: 3.48 },
};
const deepseekHost = (): Host => ({ name: "DeepSeek", base: (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/+$/, ""), key: process.env.DEEPSEEK_API_KEY ?? "" });

/** The id DeepSeek serves for one of our models, from its live list. */
async function deepseekModel(modelId: string): Promise<string> {
  const ids = await listModels(deepseekHost());
  return DEEPSEEK[modelId].api.find((n) => ids.includes(n)) ?? DEEPSEEK[modelId].api[0];
}

/** One host that speaks the OpenAI chat format: where it is, its key, and its name for errors. */
type Host = { name: string; base: string; key: string };
const nvidiaHost = (): Host => ({ name: "NVIDIA", base: nvidiaBase(), key: process.env.NVIDIA_API_KEY ?? "" });
const xaiHost = (): Host => ({ name: "xAI", base: (process.env.XAI_BASE_URL || "https://api.x.ai/v1").replace(/\/+$/, ""), key: process.env.XAI_API_KEY ?? "" });

/**
 * A reply from any OpenAI-compatible host (NVIDIA's open models, xAI's Grok). Text only: these
 * models get a note instead of pictures and PDFs.
 */
async function* openaiChat(host: Host, model: string, system: string, turns: Turn[], maxTokens: number, signal: AbortSignal, tries = 2): AsyncGenerator<ReplyEvent> {
  // These models read text only. Office files and text files already arrive as text; pictures and
  // PDFs can't be read here, so the model is told, and can say so.
  const messages = [
    { role: "system", content: system },
    ...turns.map((t) => ({
      role: t.role,
      content: t.files?.length
        ? `${t.text}\n\n[The person attached ${t.files.length} picture or PDF file${t.files.length > 1 ? "s" : ""} that this model can't open. If it matters, tell them to switch to Gemini Flash or Claude to read it.]`
        : t.text,
    })),
  ];
  const body = JSON.stringify({ model, messages, max_tokens: maxTokens, stream: true, stream_options: { include_usage: true } });
  let res: Response | null = null;
  let error: ProviderError | null = null;
  // A busy host (NVIDIA's free tier allows about 40 requests a minute per key) gets one more try
  // after a pause, then the person hears it's busy.
  for (let i = 0; i < tries && !res; i++) {
    if (i) await pause(1500, signal);
    const r = await fetch(`${host.base}/chat/completions`, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${host.key}`, accept: "text/event-stream" },
      body,
    });
    if (r.ok && r.body) {
      res = r;
      break;
    }
    const raw = await r.text().catch(() => "");
    let message = raw.slice(0, 300);
    try {
      const j = JSON.parse(raw) as { error?: { message?: string } | string; detail?: string };
      message = (typeof j.error === "string" ? j.error : j.error?.message) ?? j.detail ?? message;
    } catch {}
    console.error(`${host.name} error`, model, r.status, message);
    const kind = RETRYABLE.has(r.status) ? "busy" : r.status === 401 || r.status === 402 || r.status === 403 || r.status === 404 ? "unavailable" : "failed";
    error = new ProviderError(kind, `${host.name} ${r.status} on ${model}: ${message}`);
    if (!RETRYABLE.has(r.status)) break;
  }
  if (!res?.body) throw error ?? new ProviderError("failed");
  let inputTokens = 0;
  let outputTokens = 0;
  let stop = "end";
  let chars = 0;
  const strip = thinkFilter();
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      let chunk: {
        choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
      };
      try {
        chunk = JSON.parse(data);
      } catch {
        continue;
      }
      const choice = chunk.choices?.[0];
      // Reasoning arrives separately (reasoning_content) and is left out; only the answer is shown.
      const text = choice?.delta?.content ? strip(choice.delta.content) : "";
      if (text) {
        chars += text.length;
        yield { type: "text", text };
      }
      if (choice?.finish_reason) stop = choice.finish_reason === "length" ? "max_tokens" : choice.finish_reason === "content_filter" ? "refusal" : "end";
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? inputTokens;
        outputTokens = chunk.usage.completion_tokens ?? outputTokens;
      }
    }
  }
  // Some hosts send no usage: estimate from the text (about 4 characters a token).
  if (!outputTokens) outputTokens = Math.ceil(chars / 4);
  if (!inputTokens) inputTokens = Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / 4);
  yield { type: "done", inputTokens, outputTokens, stop };
}

// ---------------------------------------------------------------- Auto (free)

/*
 * "Auto (free)" spreads replies over free tiers: each host below joins when its key is set, and
 * the first one that answers wins. Hosts that are busy or out of quota rest for 10 minutes, so
 * the next reply goes straight to one that works. Gemini Flash is the last resort. Each host's
 * models are matched against its live list, so retired ids drop out on their own.
 */
const POOL_HOSTS: { id: string; name: string; base: string; env: string; models: (ids: string[]) => string[] }[] = [
  { id: "cerebras", name: "Cerebras", base: "https://api.cerebras.ai/v1", env: "CEREBRAS_API_KEY", models: (ids) => pick(ids, ["gpt-oss-120b", "zai-glm-4.7", "qwen-3-235b-a22b-instruct-2507", "llama-3.3-70b"]) },
  { id: "groq", name: "Groq", base: "https://api.groq.com/openai/v1", env: "GROQ_API_KEY", models: (ids) => pick(ids, ["moonshotai/kimi-k2-instruct-0905", "openai/gpt-oss-120b", "llama-3.3-70b-versatile"]) },
  { id: "nvidia", name: "NVIDIA", base: "", env: "NVIDIA_API_KEY", models: (ids) => pick(ids, [...NVIDIA["glm-flash"], ...NVIDIA["deepseek-flash"]]) },
  { id: "mistral", name: "Mistral", base: "https://api.mistral.ai/v1", env: "MISTRAL_API_KEY", models: (ids) => pick(ids, ["mistral-medium-latest", "mistral-small-latest"]) },
  {
    id: "openrouter",
    name: "OpenRouter",
    base: "https://openrouter.ai/api/v1",
    env: "OPENROUTER_API_KEY",
    // Free models end in ":free"; prefer well-known families.
    models: (ids) => ids.filter((m) => m.endsWith(":free") && /deepseek|qwen|glm|kimi|nemotron|gpt-oss|llama-3\.3-70b/.test(m)).slice(0, 2),
  },
];

/** The wanted ids this host serves, in order (at most two). */
const pick = (ids: string[], wanted: string[]) => wanted.filter((w) => ids.includes(w)).slice(0, 2);

const poolHost = (h: (typeof POOL_HOSTS)[number]): Host => (h.id === "nvidia" ? nvidiaHost() : { name: h.name, base: h.base, key: process.env[h.env] ?? "" });

const hostModels = new Map<string, { ids: string[]; at: number }>();

/** A host's model list, checked at most once an hour. */
async function listModels(host: Host): Promise<string[]> {
  const cached = hostModels.get(host.base);
  if (cached && Date.now() - cached.at < 3600_000) return cached.ids;
  let ids: string[] = [];
  try {
    const r = await fetch(`${host.base}/models`, { headers: { authorization: `Bearer ${host.key}` }, signal: AbortSignal.timeout(8000) });
    if (r.ok) ids = ((await r.json()) as { data?: { id: string }[] }).data?.map((m) => m.id) ?? [];
    else console.error(`${host.name} models list failed`, r.status);
  } catch {}
  hostModels.set(host.base, { ids, at: Date.now() });
  return ids;
}

/** Every host and model Auto (free) would try, in order, and whether each is resting. */
export async function poolPlan() {
  const out: { id: string; host: Host; label: string; model: string; resting: boolean }[] = [];
  for (const h of POOL_HOSTS) {
    if (!process.env[h.env]) continue;
    const host = poolHost(h);
    for (const model of h.models(await listModels(host)))
      out.push({ id: `${h.id}:${model}`, host, label: h.name, model, resting: (resting.get(`${h.id}:${model}`) ?? 0) > Date.now() });
  }
  return out;
}

async function* pool(system: string, turns: Turn[], maxTokens: number, signal: AbortSignal, geminiToo = true): AsyncGenerator<ReplyEvent> {
  // Pictures and PDFs need a model that can see them: Gemini, when it's there.
  if (geminiToo && geminiKeys().length && turns.some((t) => t.files?.length)) return yield* gemini(system, turns, maxTokens, signal);
  const tried: string[] = [];
  for (const c of (await poolPlan()).filter((c) => !c.resting).slice(0, 4)) {
    const it = openaiChat(c.host, c.model, system, turns, maxTokens, signal, 1);
    let first: IteratorResult<ReplyEvent>;
    try {
      // Nothing has reached the person before the first piece arrives, so a failure here quietly
      // moves on to the next host.
      first = await it.next();
    } catch (e) {
      if (signal.aborted) throw e;
      resting.set(c.id, Date.now() + 10 * 60_000);
      tried.push(`${c.label} ${c.model}: ${errorDetail(e).slice(0, 120)}`);
      continue;
    }
    if (!first.done) yield first.value;
    yield* it;
    return;
  }
  if (geminiToo && geminiKeys().length) return yield* gemini(system, turns, maxTokens, signal);
  throw new ProviderError("busy", tried.length ? `Every free host was busy: ${tried.join(" · ")}` : "No free host has a key");
}

// ---------------------------------------------------------------- Shared

export class ProviderError extends Error {
  /** `detail` is the provider's own message, shown only to staff. */
  constructor(
    public kind: "busy" | "failed" | "unavailable",
    public detail = "",
  ) {
    super(detail || kind);
  }
}

/** What went wrong, in the provider's words, for the team. */
export function errorDetail(e: unknown): string {
  if (e instanceof ProviderError) return e.detail || e.kind;
  if (e instanceof Anthropic.APIError) return `Anthropic ${e.status ?? ""}: ${e.message}`.slice(0, 400);
  return e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 400) : String(e);
}

/**
 * A tiny real call to each provider with a key, for the admin page: which model would be used,
 * and the provider's answer or error.
 */
export async function checkProviders() {
  const out: { provider: string; model: string; ok: boolean; detail: string; ms: number }[] = [];
  const signal = AbortSignal.timeout(20_000);
  for (const [provider, modelId] of [
    ["google", "gemini-flash"],
    ["argo", "gemini-argo"],
    ["anthropic", "haiku"],
    ["nvidia", "glm-flash"],
    ["xai", "grok"],
    ["deepseek", "deepseek"],
    ["pool", "free"],
  ] as const) {
    if (!providers()[provider]) {
      out.push({ provider, model: "", ok: false, detail: "No API key set", ms: 0 });
      continue;
    }
    const t = Date.now();
    let text = "";
    let model =
      provider === "google"
        ? (await geminiModels(geminiKeys()[0])).join(" → ")
        : provider === "argo"
          ? argoModel()
        : provider === "nvidia"
          ? await nvidiaModel(modelId)
          : provider === "xai"
            ? GROK.grok.api
            : provider === "deepseek"
              ? await deepseekModel(modelId)
              : provider === "pool"
                ? (await poolPlan()).map((p) => `${p.label} ${p.model}${p.resting ? " (resting)" : ""}`).join(" → ") || "Gemini only"
                : CLAUDE.haiku.api;
    try {
      for await (const ev of streamReply({ modelId, tool: "chat", system: "Reply with one word.", turns: [{ role: "user", text: "Say hello." }], signal })) {
        if (ev.type === "text") text += ev.text;
        else model += ` · ${ev.inputTokens} in / ${ev.outputTokens} out · ${ev.stop}`;
      }
      out.push({ provider, model, ok: !!text, detail: text ? `Replied: ${text.slice(0, 60)}` : "Empty reply", ms: Date.now() - t });
    } catch (e) {
      out.push({ provider, model, ok: false, detail: errorDetail(e), ms: Date.now() - t });
    }
  }
  // Images: one small picture, measured by size only (an image comes back as hundreds of KB).
  if (providers().google) {
    const t = Date.now();
    try {
      const { res, model } = await requestImage("A small red circle on a plain white background.", [], AbortSignal.timeout(60_000));
      const bytes = (await res.arrayBuffer()).byteLength;
      out.push({ provider: "google images", model, ok: bytes > 20_000, detail: bytes > 20_000 ? `Made an image (${Math.round(bytes / 1024)} KB)` : "No image came back", ms: Date.now() - t });
    } catch (e) {
      out.push({ provider: "google images", model: (await geminiImageModels(geminiKeys()[0])).join(" → "), ok: false, detail: errorDetail(e), ms: Date.now() - t });
    }
  }
  return out;
}

export function streamReply(opts: { modelId: string; tool: ToolId; system: string; turns: Turn[]; signal: AbortSignal }): AsyncGenerator<ReplyEvent> {
  const max = MAX_OUTPUT[opts.tool === "code" || opts.tool === "design" ? opts.tool : "chat"];
  // Models the catalog lists as coming soon (no provider) never run, whatever keys are set.
  if (!MODELS.find((m) => m.id === opts.modelId)?.provider) throw new ProviderError("unavailable");
  if (opts.modelId === "gemini-argo") {
    const model = argoModel();
    if (!model || !argoKeys().length) throw new ProviderError("unavailable");
    return gemini(opts.system, opts.turns, max, opts.signal, opts.tool === "chat", model);
  }
  if (opts.modelId === "gemini-flash") {
    if (!geminiKeys().length) throw new ProviderError("unavailable");
    return gemini(opts.system, opts.turns, max, opts.signal, opts.tool === "chat");
  }
  if (CLAUDE[opts.modelId]) {
    if (!process.env.ANTHROPIC_API_KEY) throw new ProviderError("unavailable");
    return claude(opts.modelId, opts.tool, opts.system, opts.turns, max, opts.signal);
  }
  if (NVIDIA[opts.modelId]) {
    if (!process.env.NVIDIA_API_KEY) throw new ProviderError("unavailable");
    return (async function* () {
      yield* openaiChat(nvidiaHost(), await nvidiaModel(opts.modelId), opts.system, opts.turns, max, opts.signal);
    })();
  }
  if (DEEPSEEK[opts.modelId]) {
    if (!process.env.DEEPSEEK_API_KEY) throw new ProviderError("unavailable");
    return (async function* () {
      yield* openaiChat(deepseekHost(), await deepseekModel(opts.modelId), opts.system, opts.turns, max, opts.signal);
    })();
  }
  if (opts.modelId === "free") {
    if (!providers().pool) throw new ProviderError("unavailable");
    return pool(opts.system, opts.turns, max, opts.signal);
  }
  if (GROK[opts.modelId]) {
    if (!process.env.XAI_API_KEY) throw new ProviderError("unavailable");
    return openaiChat(xaiHost(), GROK[opts.modelId].api, opts.system, opts.turns, max, opts.signal);
  }
  throw new ProviderError("unavailable");
}

/** Turns an error from either provider into a kind the chat route can explain. */
export function errorKind(e: unknown): "busy" | "failed" | "unavailable" | "aborted" {
  if (e instanceof ProviderError) return e.kind;
  if (e instanceof Anthropic.APIUserAbortError || (e instanceof Error && e.name === "AbortError")) return "aborted";
  if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError) return "busy";
  if (e instanceof Anthropic.APIError && e.status === 529) return "busy";
  return "failed";
}
