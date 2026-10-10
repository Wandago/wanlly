import "server-only";
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
  const google = !!process.env.GEMINI_API_KEY;
  const nvidia = !!process.env.NVIDIA_API_KEY;
  return {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    google,
    nvidia,
    xai: !!process.env.XAI_API_KEY,
    deepseek: !!process.env.DEEPSEEK_API_KEY,
    // Auto (free) runs when any free host has a key; Gemini is its last resort.
    pool: google || POOL_HOSTS.some((h) => !!process.env[h.env]),
  };
}

/** Model cost in US dollars for one reply. Gemini and the NVIDIA-hosted models run on free tiers for now, so they're 0. */
export function replyCostUsd(modelId: string, inputTokens: number, outputTokens: number): number {
  const c = CLAUDE[modelId] ?? GROK[modelId] ?? DEEPSEEK[modelId];
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

/** Models resting after a timeout or overload, until this time. */
const resting = new Map<string, number>();

/** Google's "too busy" answers: worth another try, or another model. */
// 502 and the 52x codes are Google's gateway timing out or failing on a slow model: try another.
const RETRYABLE = new Set([429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 529]);

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
  // Models that recently timed out or were overloaded go to the back of the line for a while.
  const all = await geminiModels(key);
  const now = Date.now();
  const models = [...all.filter((m) => (resting.get(m) ?? 0) <= now), ...all.filter((m) => (resting.get(m) ?? 0) > now)];
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
    // Overloaded or timed out: rest this model for 10 minutes. A timeout already took long, so
    // don't wait on the same model again; go straight to the next one.
    if (r.status === 503 || r.status >= 520) {
      resting.set(model, Date.now() + 10 * 60_000);
      if (r.status >= 520 && tries[i + 1] === model) i++;
    }
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
      messages: opts.messages,
      tools: [{ type: "text_editor_20250728", name: "str_replace_based_edit_tool", max_characters: 40000 }],
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

/**
 * Checks a Builder project in Anthropic's code sandbox: the project goes up as a zip, Claude
 * unpacks it, installs what it can, runs the build and tests, and reports without changing
 * anything. The upload is deleted afterwards.
 */
export async function claudeSandboxCheck(opts: { modelId: string; zip: Blob; signal: AbortSignal }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new ProviderError("unavailable");
  anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1 });
  const m = CLAUDE[opts.modelId];
  if (!m) throw new ProviderError("unavailable");
  const uploaded = await anthropic.files.upload({ file: await toFile(opts.zip, "project.zip", { type: "application/zip" }) });
  try {
    const stream = anthropic.messages.stream(
      {
        model: m.api,
        max_tokens: 16000,
        tools: [{ type: "code_execution_20260521", name: "code_execution" }],
        output_config: { effort: "low" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "project.zip holds a web project someone is building. Unzip it into a fresh folder and check it, without changing any file:\n1. Look at what kind of project it is.\n2. If there's a package.json or requirements.txt, try to install dependencies. The sandbox may have no internet; if installs fail, say so and do what you can without them.\n3. Run its build and its tests if it has them. Otherwise run syntax checks (node --check on .js files, python -m py_compile on .py files) and look for obvious broken references (missing files, scripts or stylesheets that don't exist).\n4. Reply with a short report: what you ran, what passed, and for each failure the exact error lines and the likely cause. No other commentary.",
              },
              { type: "container_upload", file_id: uploaded.id },
            ],
          },
        ],
      },
      { signal: opts.signal },
    );
    const message = await stream.finalMessage();
    const report = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { report, inputTokens: billedInput(opts.modelId, message.usage), outputTokens: message.usage.output_tokens };
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
  kimi: ["moonshotai/kimi-k3", "moonshotai/kimi-k3-instruct"],
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
  return names.find((n) => nvidiaList!.ids.has(n)) ?? names[0];
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

async function* pool(system: string, turns: Turn[], maxTokens: number, signal: AbortSignal): AsyncGenerator<ReplyEvent> {
  // Pictures and PDFs need a model that can see them: Gemini, when it's there.
  if (process.env.GEMINI_API_KEY && turns.some((t) => t.files?.length)) return yield* gemini(system, turns, maxTokens, signal);
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
  if (process.env.GEMINI_API_KEY) return yield* gemini(system, turns, maxTokens, signal);
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
        ? (await geminiModels(process.env.GEMINI_API_KEY!)).join(" → ")
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
      out.push({ provider: "google images", model: (await geminiImageModels(process.env.GEMINI_API_KEY!)).join(" → "), ok: false, detail: errorDetail(e), ms: Date.now() - t });
    }
  }
  return out;
}

export function streamReply(opts: { modelId: string; tool: ToolId; system: string; turns: Turn[]; signal: AbortSignal }): AsyncGenerator<ReplyEvent> {
  const max = MAX_OUTPUT[opts.tool === "code" || opts.tool === "design" ? opts.tool : "chat"];
  // Models the catalog lists as coming soon (no provider) never run, whatever keys are set.
  if (!MODELS.find((m) => m.id === opts.modelId)?.provider) throw new ProviderError("unavailable");
  if (opts.modelId === "gemini-flash") {
    if (!process.env.GEMINI_API_KEY) throw new ProviderError("unavailable");
    return gemini(opts.system, opts.turns, max, opts.signal);
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
