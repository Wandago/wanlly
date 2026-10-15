/**
 * Wanlly Buddy Proxy Worker
 *
 * Proxies requests to Claude, ElevenLabs and AssemblyAI so the app never
 * ships with raw API keys. Keys are stored as Cloudflare secrets.
 *
 * Every request must carry the shared app token in the `X-App-Token` header
 * (secret: APP_SHARED_SECRET). /chat only accepts allowlisted models and caps
 * max_tokens, so a leaked Worker URL can't be used as a free Claude endpoint.
 *
 * Routes:
 *   POST /chat              → Anthropic Messages API (streaming)
 *   POST /tts               → ElevenLabs TTS API
 *   POST /transcribe-token  → short-lived AssemblyAI streaming token
 */

interface Env {
  ANTHROPIC_API_KEY: string;
  ELEVENLABS_API_KEY: string;
  ELEVENLABS_VOICE_ID: string;
  ASSEMBLYAI_API_KEY: string;
  APP_SHARED_SECRET: string;
}

/** Models the app is allowed to request. Keep in sync with ClaudeAPI.swift. */
const ALLOWED_CHAT_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);

/** Upper bound on output tokens per request (thinking + spoken answer). */
const MAX_OUTPUT_TOKENS = 4096;

/** Longest text the app may send to TTS in one request. */
const MAX_TTS_CHARACTERS = 5000;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (!(await isAuthorizedAppRequest(request, env))) {
      return jsonError(401, "Missing or invalid app token");
    }

    try {
      if (url.pathname === "/chat") {
        return await handleChat(request, env);
      }

      if (url.pathname === "/tts") {
        return await handleTTS(request, env);
      }

      if (url.pathname === "/transcribe-token") {
        return await handleTranscribeToken(env);
      }
    } catch (error) {
      console.error(`[${url.pathname}] Unhandled error:`, error);
      return jsonError(500, "Internal error");
    }

    return new Response("Not found", { status: 404 });
  },
};

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Compares the request's app token against APP_SHARED_SECRET in constant time.
 * Fails closed: if the secret isn't configured, every request is rejected.
 */
async function isAuthorizedAppRequest(request: Request, env: Env): Promise<boolean> {
  const expectedToken = env.APP_SHARED_SECRET;
  const providedToken = request.headers.get("x-app-token");
  if (!expectedToken || !providedToken) {
    return false;
  }

  // Hash both sides so timingSafeEqual always compares equal-length buffers.
  const encoder = new TextEncoder();
  const [expectedDigest, providedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expectedToken)),
    crypto.subtle.digest("SHA-256", encoder.encode(providedToken)),
  ]);
  return crypto.subtle.timingSafeEqual(expectedDigest, providedDigest);
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  let chatRequestBody: Record<string, unknown>;
  try {
    chatRequestBody = await request.json();
  } catch {
    return jsonError(400, "Body must be JSON");
  }

  const requestedModel = chatRequestBody.model;
  if (typeof requestedModel !== "string" || !ALLOWED_CHAT_MODELS.has(requestedModel)) {
    return jsonError(400, "Model not allowed");
  }

  const requestedMaxTokens = Number(chatRequestBody.max_tokens);
  chatRequestBody.max_tokens = Number.isFinite(requestedMaxTokens) && requestedMaxTokens > 0
    ? Math.min(requestedMaxTokens, MAX_OUTPUT_TOKENS)
    : MAX_OUTPUT_TOKENS;

  // The app only uses plain vision chat. Strip anything that could turn this
  // proxy into a general-purpose agent endpoint.
  delete chatRequestBody.tools;
  delete chatRequestBody.mcp_servers;
  delete chatRequestBody.container;

  // If a safety classifier declines the request, let the API retry it on a
  // suitable fallback model instead of returning an empty answer.
  chatRequestBody.fallbacks = "default";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "server-side-fallback-2026-07-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(chatRequestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[/chat] Anthropic API error ${response.status}: ${errorBody}`);
    return new Response(errorBody, {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(response.body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "text/event-stream",
      "cache-control": "no-cache",
    },
  });
}

async function handleTranscribeToken(env: Env): Promise<Response> {
  const response = await fetch(
    "https://streaming.assemblyai.com/v3/token?expires_in_seconds=480",
    {
      method: "GET",
      headers: {
        authorization: env.ASSEMBLYAI_API_KEY,
      },
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[/transcribe-token] AssemblyAI token error ${response.status}: ${errorBody}`);
    return new Response(errorBody, {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  }

  const data = await response.text();
  return new Response(data, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

async function handleTTS(request: Request, env: Env): Promise<Response> {
  let ttsRequestBody: Record<string, unknown>;
  try {
    ttsRequestBody = await request.json();
  } catch {
    return jsonError(400, "Body must be JSON");
  }

  if (typeof ttsRequestBody.text !== "string" || ttsRequestBody.text.length > MAX_TTS_CHARACTERS) {
    return jsonError(400, `text must be a string of at most ${MAX_TTS_CHARACTERS} characters`);
  }

  const voiceId = env.ELEVENLABS_VOICE_ID;

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": env.ELEVENLABS_API_KEY,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify(ttsRequestBody),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[/tts] ElevenLabs API error ${response.status}: ${errorBody}`);
    return new Response(errorBody, {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(response.body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "audio/mpeg",
    },
  });
}
