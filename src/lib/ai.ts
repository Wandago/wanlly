import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Providers, ToolId } from "./catalog";

/*
 * The model providers behind chat. Each one streams the same small set of events, so the chat
 * route doesn't care which model answered. Keys live only in Cloudflare secrets.
 */

/** One turn of a conversation. `files` are images or PDFs, as base64, for this turn only. */
export type Turn = { role: "user" | "assistant"; text: string; files?: { mime: string; data: string }[] };
export type ReplyEvent = { type: "text"; text: string } | { type: "done"; inputTokens: number; outputTokens: number; stop: string };

/** Claude models: API id and US dollars per million tokens (input, output). */
const CLAUDE: Record<string, { api: string; usdIn: number; usdOut: number; fallbacks: boolean }> = {
  haiku: { api: "claude-haiku-5-5", usdIn: 0.1, usdOut: 0.5, fallbacks: false },
  sonnet: { api: "claude-sonnet-5-5", usdIn: 2, usdOut: 10, fallbacks: true },
  opus: { api: "claude-opus-5-5", usdIn: 4, usdOut: 20, fallbacks: true },
  fable: { api: "claude-fable-5-1", usdIn: 10, usdOut: 50, fallbacks: true },
};

export function providers(): Providers {
  return { anthropic: !!process.env.ANTHROPIC_API_KEY, google: !!process.env.GEMINI_API_KEY };
}

/** Model cost in US dollars for one reply. Gemini runs on Google's free tier for now, so it's 0. */
export function replyCostUsd(modelId: string, inputTokens: number, outputTokens: number): number {
  const c = CLAUDE[modelId];
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
  return [...new Set([...stable.slice(0, 2), ...preview.slice(0, 1), ...GEMINI_FALLBACKS])];
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

/** Google's "too busy" answers: worth another try, or another model. */
const RETRYABLE = new Set([429, 500, 503, 504]);

const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), reject(signal.reason)), { once: true });
  });

async function* gemini(system: string, turns: Turn[], maxTokens: number, signal: AbortSignal): AsyncGenerator<ReplyEvent> {
  const key = process.env.GEMINI_API_KEY!;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: turns.map((t) => ({
      role: t.role === "assistant" ? "model" : "user",
      parts: [...(t.files ?? []).map((f) => ({ inlineData: { mimeType: f.mime, data: f.data } })), { text: t.text }],
    })),
    generationConfig: { maxOutputTokens: maxTokens },
  });
  // A busy model gets one more try after a pause, then the next model is tried. All of this
  // happens before any words arrive, so the person only sees a slightly longer wait.
  const models = await geminiModels(key);
  const tries = [models[0], ...models].slice(0, 5);
  let res: Response | null = null;
  let error: ProviderError | null = null;
  for (let i = 0; i < tries.length && !res; i++) {
    const model = tries[i];
    if (i > 0) await pause(i === 1 ? 1200 : 300, signal);
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body,
    });
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
    // 402/403: billing or key problems on Wanlly's side, not something the person can retry.
    const kind = RETRYABLE.has(r.status) ? "busy" : r.status === 402 || r.status === 403 ? "unavailable" : "failed";
    error = new ProviderError(kind, `Google ${r.status} on ${model}: ${message}${i ? ` (try ${i + 1})` : ""}`);
    // Busy models and ones this key can't use (404) move on to the next; anything else stops.
    if (!RETRYABLE.has(r.status) && r.status !== 404) break;
    if (r.status === 404 && tries[i + 1] === model) i++;
  }
  if (!res?.body) throw error ?? new ProviderError("failed");
  let inputTokens = 0;
  let outputTokens = 0;
  let stop = "end";
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
      for (const part of cand?.content?.parts ?? []) if (part.text && !part.thought) yield { type: "text", text: part.text };
      if (cand?.finishReason) stop = cand.finishReason === "MAX_TOKENS" ? "max_tokens" : cand.finishReason === "STOP" ? "end" : "refusal";
      if (chunk.usageMetadata) {
        inputTokens = chunk.usageMetadata.promptTokenCount ?? inputTokens;
        outputTokens = (chunk.usageMetadata.candidatesTokenCount ?? 0) + (chunk.usageMetadata.thoughtsTokenCount ?? 0) || outputTokens;
      }
    }
  }
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
  const key = process.env.GEMINI_API_KEY;
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
      ...(m.fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    },
    { signal },
  );
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield { type: "text", text: event.delta.text };
  }
  const final = await stream.finalMessage();
  const stop = final.stop_reason === "refusal" ? "refusal" : final.stop_reason === "max_tokens" ? "max_tokens" : "end";
  yield { type: "done", inputTokens: final.usage.input_tokens + (final.usage.cache_read_input_tokens ?? 0), outputTokens: final.usage.output_tokens, stop };
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
    ["anthropic", "haiku"],
  ] as const) {
    if (!providers()[provider]) {
      out.push({ provider, model: "", ok: false, detail: "No API key set", ms: 0 });
      continue;
    }
    const t = Date.now();
    let text = "";
    let model = provider === "google" ? (await geminiModels(process.env.GEMINI_API_KEY!)).join(" → ") : CLAUDE.haiku.api;
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
      out.push({ provider: "google images", model: (await geminiImageModels(process.env.GEMINI_API_KEY!)).join(" → "), ok: false, detail: errorDetail(e), ms: Date.now() - t });
    }
  }
  return out;
}

export function streamReply(opts: { modelId: string; tool: ToolId; system: string; turns: Turn[]; signal: AbortSignal }): AsyncGenerator<ReplyEvent> {
  const max = MAX_OUTPUT[opts.tool === "code" || opts.tool === "design" ? opts.tool : "chat"];
  if (opts.modelId === "gemini-flash") {
    if (!process.env.GEMINI_API_KEY) throw new ProviderError("unavailable");
    return gemini(opts.system, opts.turns, max, opts.signal);
  }
  if (CLAUDE[opts.modelId]) {
    if (!process.env.ANTHROPIC_API_KEY) throw new ProviderError("unavailable");
    return claude(opts.modelId, opts.tool, opts.system, opts.turns, max, opts.signal);
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
