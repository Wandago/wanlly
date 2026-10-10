# The Builder (and paying for it)

The Builder (`/build`, sidebar → Builder) makes whole apps out of real files, step by step.

## How it works

- **Files and conversation** live in Neon: `build_files` (one row per file) and `build_steps` (the conversation, verbatim). Migration **0017**.
- **Steps.** The browser calls `/api/build/[id]/step` once per step. Claude reads the conversation, then either replies or edits files with its text editor tool (view, create, exact-passage replace, insert). Edits are applied, saved, and the next step continues until Claude is done, the person presses Stop, or 25 steps pass ("Continue" carries on).
- **Cost per step:** a starting price (the model's credits), then what the step really used. Steps re-read the conversation from the prompt cache (Opus cache reads cost a twentieth of normal input).
- **Smart building** (on by default): the chosen model plans the first step, Sonnet does the rest.
- **Preview:** web apps (index.html with linked CSS/JS, JS modules included) and React apps (App.jsx plus components) run in a sandboxed frame. Errors there can be handed back to the AI ("Ask the AI to fix").
- **Run checks:** the project runs in Anthropic's code sandbox (Files API + code execution): installs what it can, builds, tests, reports. Nothing is changed.
- **GitHub:** saves to a private repository on the person's GitHub as one commit.
- **Publish:** puts web/React apps online at `/s/<name>`, sandboxed, with a "Built free with Wanlly · Sponsored by …" bar and a Report link. Migration **0018**. Admin → Abuse → Published apps can take one down.

## What it needs

| For | Setting |
|---|---|
| Everything | `ANTHROPIC_API_KEY` (the Builder runs on Claude: Haiku, Sonnet or Opus) |
| Database | Run `drizzle/0017_builder.sql` and `drizzle/0018_published_sites.sql` in Neon |
| GitHub | Clerk → SSO connections → GitHub on (with production OAuth credentials). Wanlly asks for the `repo` permission the first time someone saves |
| Run checks | Nothing extra: uses the same Anthropic key (code execution has a free monthly allowance, then about $0.05 an hour) |

Not built yet: steps that keep running after the tab closes (needs a queue or Workflows binding on a paid Cloudflare plan). Today an interrupted request offers "Continue" when the app is reopened.

## Making it pay for itself

1. **Cheaper AI:** prompt caching on code, design and longer chats; exact edits instead of rewrites; Smart building. Credits follow the real (cached) bill, so users pay less too.
2. **Ads that pay their way:** Admin → Money → Credits per ad. "Follow real earnings" pays viewers a share (70% by default) of what ads really earned per finished ad, once 300 ads are measured.
3. **Bigger-ticket income:** sponsor offers paid per sign-up (Admin → Affiliates: credits for the person, payout, click-id parameter; give the partner the postback address shown there), the sponsor line on published apps, and startup credits (Anthropic, Google, Microsoft) as a subsidy pool.
