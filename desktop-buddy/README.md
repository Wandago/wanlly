# Wanlly Buddy

An AI buddy that lives in your Mac's menu bar. Hold **Control + Option** and ask a question out loud. It looks at your screen, answers out loud, and a little blue cursor flies over to point at the exact button, menu or line you need.

Wanlly Buddy is the desktop companion to Wanlly. It's built on the open-source [Clicky](https://github.com/farzaa/clicky) codebase (MIT license, see `LICENSE`), rebranded and changed as described below.

## How it works

```
 hold ctrl+option ──► mic audio ──► AssemblyAI (live transcript)
                                         │
 release ──► screenshot of each display ─┤
                                         ▼
                           Claude (vision, streamed via SSE)
                                         │
              ┌──────────────────────────┴───────────────────────┐
              ▼                                                  ▼
  spoken answer (ElevenLabs TTS)          [POINT:x,y:label:screenN] tag
                                          → blue cursor flies to it
```

All three APIs go through a small Cloudflare Worker (`worker/`) so no API keys ship inside the app.

## What's different from upstream Clicky

- **Rebranded** as Wanlly Buddy (app name, bundle ID `com.wandago.wanlly-buddy`, all user-facing text, system prompts).
- **Current Claude models:** Claude Opus 5.5 by default, with Claude Sonnet 5.5 in the model picker. Requests use `effort: low` for fast spoken answers.
- **The Worker is locked down.** Upstream it was an open proxy: anyone with the URL could spend your API credits on any model. Now it:
  - requires an `X-App-Token` header that matches the `APP_SHARED_SECRET` secret,
  - only allows the two models above and caps `max_tokens`,
  - strips `tools` and MCP fields from chat requests,
  - limits TTS text length,
  - turns on server-side refusal fallbacks (`fallbacks: "default"`).
- **The original author's endpoints are removed:** their PostHog key, the FormSpark email form, the Mux onboarding video, the Sparkle update feed, and the "DM Farza" link. Each is now an optional Info.plist key (below) and turns off when left empty.
- **Analytics no longer send transcripts or AI responses**, only character counts.
- **Media with unclear licensing removed:** two music tracks (including the onboarding music) and an unused photo, plus screenshots from the author's other project.
- **No signing team is set.** Pick your own in Xcode.

## Setup

### Prerequisites

- macOS 14.2+ (for ScreenCaptureKit) and Xcode 16+
- Node.js 18+
- A Cloudflare account (the free plan works)
- API keys for [Anthropic](https://console.anthropic.com), [AssemblyAI](https://www.assemblyai.com) and [ElevenLabs](https://elevenlabs.io)

### 1. Deploy the Worker

```bash
cd desktop-buddy/worker
npm install

npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put ASSEMBLYAI_API_KEY
npx wrangler secret put ELEVENLABS_API_KEY
npx wrangler secret put APP_SHARED_SECRET     # any long random string, e.g. `openssl rand -hex 32`
```

Set `ELEVENLABS_VOICE_ID` in `wrangler.toml` to a voice from your ElevenLabs account, then run:

```bash
npx wrangler deploy
```

Copy the URL it prints, e.g. `https://wanlly-buddy-proxy.<you>.workers.dev`.

For local development, copy `.dev.vars.example` to `.dev.vars`, fill it in, and run `npx wrangler dev`. It serves on `http://localhost:8787`.

### 2. Configure the app

Edit `leanring-buddy/Info.plist`:

| Key | Required | What it does |
|---|---|---|
| `WorkerBaseURL` | yes | Your Worker URL from step 1 |
| `WorkerAppToken` | yes | The same value as `APP_SHARED_SECRET` |
| `PostHogAPIKey` | no | Turns on usage analytics |
| `EmailSignupURL` | no | Endpoint that receives `{"email": ...}` from onboarding |
| `FeedbackURL` | no | Link for the "Got feedback?" button, which is hidden when empty |
| `OnboardingVideoURL` | no | Intro video (HLS or MP4). When empty, onboarding goes straight to the pointing demo |
| `SUFeedURL` / `SUPublicEDKey` | no | Your Sparkle auto-update feed (the updater is off in code) |

The app token ships inside the app, so it stops casual abuse of your Worker but not a determined attacker. Once Wanlly has accounts, swap it for per-user sign-in plus per-user rate limits on the Worker.

### 3. Build and run

```bash
open desktop-buddy/leanring-buddy.xcodeproj
```

Select the `leanring-buddy` scheme (the typo is inherited from upstream and renaming it breaks the project). Set your team under **Signing & Capabilities**, then press **Cmd + R**. The app appears in the menu bar, not the Dock. Grant **Microphone**, **Accessibility**, **Screen Recording** and **Screen Content** when asked.

## Costs

Each question sends one screenshot per display plus a short transcript to Claude, and one short answer to ElevenLabs. Set a monthly spend limit in the Anthropic Console before you share the app. Claude Sonnet 5.5 costs half as much per token as Opus 5.5 and is noticeably faster, so switch the default in `ClaudeAPI.swift` if speed or cost matters more than answer quality.

## Not built yet

HeyClicky also has these, and they would be the next pieces to add:

- **Agent mode:** "hey buddy, do X", where the buddy clicks and types for you. This would use Claude's computer-use tool with a confirmation step before each action.
- **Dictation:** a hotkey that types what you say into the focused text field.
- **Accounts, plans and usage limits:** for example, free = 25 messages and Pro = unlimited. This fits Wanlly's existing Clerk + Neon plan (see `../docs/PLAN.md`).
- **Windows version.**
- **Marketing site and download page.**

See `AGENTS.md` for the full architecture and file-by-file guide.
