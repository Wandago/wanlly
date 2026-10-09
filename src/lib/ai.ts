import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Providers, ToolId } from "./catalog";

/*
 * The model providers behind chat. Each one streams the same small set of events, so the chat
 * route doesn't care which model answered. Keys live only in Cloudflare secrets.
 */

export type Turn = { role: "user" | "assistant"; text: string };
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

/** Longest reply per tool. Code needs room for whole files; chat answers stay readable. */
export const MAX_OUTPUT: Record<Extract<ToolId, "chat" | "code">, number> = { chat: 8000, code: 16000 };

// ---------------------------------------------------------------- Google

let geminiPick: { model: string; at: number } | null = null;

/**
 * The newest plain Flash model this key can stream from, checked at most once an hour.
 * GEMINI_MODEL pins one instead.
 */
async function geminiModel(key: string): Promise<string> {
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
  if (geminiPick && Date.now() - geminiPick.at < 3600_000) return geminiPick.model;
  let model = "gemini-flash-latest";
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": key } });
    if (!r.ok) console.error("gemini models list failed", r.status);
    if (r.ok) {
      const { models = [] } = (await r.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
      const flash = models
        .filter((m) => m.supportedGenerationMethods?.includes("streamGenerateContent"))
        .map((m) => m.name.replace(/^models\//, ""))
        .filter((n) => /^gemini-\d+(\.\d+)?-flash$/.test(n))
        .sort((a, b) => parseFloat(b.slice(7)) - parseFloat(a.slice(7)));
      if (flash[0]) model = flash[0];
    }
  } catch {}
  geminiPick = { model, at: Date.now() };
  return model;
}

async function* gemini(system: string, turns: Turn[], maxTokens: number, signal: AbortSignal): AsyncGenerator<ReplyEvent> {
  const key = process.env.GEMINI_API_KEY!;
  const model = await geminiModel(key);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.text }] })),
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok || !res.body) {
    const raw = await res.text().catch(() => "");
    let message = raw.slice(0, 300);
    try {
      message = (JSON.parse(raw) as { error?: { message?: string } }).error?.message ?? message;
    } catch {}
    console.error("gemini error", model, res.status, message);
    throw new ProviderError(res.status === 429 ? "busy" : "failed", `Google ${res.status} on ${model}: ${message}`);
  }
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
      messages: turns.map((t) => ({ role: t.role, content: t.text })),
      output_config: { effort: tool === "code" ? "medium" : "low" },
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
    let model = provider === "google" ? await geminiModel(process.env.GEMINI_API_KEY!) : CLAUDE.haiku.api;
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
  return out;
}

export function streamReply(opts: { modelId: string; tool: ToolId; system: string; turns: Turn[]; signal: AbortSignal }): AsyncGenerator<ReplyEvent> {
  const max = MAX_OUTPUT[opts.tool === "code" ? "code" : "chat"];
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
