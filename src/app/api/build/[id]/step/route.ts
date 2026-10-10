import type Anthropic from "@anthropic-ai/sdk";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { blockedReason } from "@/lib/admin";
import { claudeBuildStep, errorDetail, errorKind, geminiBuildStep, isClaudeModel, providers, replyCostUsd } from "@/lib/ai";
import { BUILD_SYSTEM, MAX_HISTORY_CHARS, loadFiles, loadSteps, ownBuild, runEditor } from "@/lib/build";
import { ESTIMATE, MODELS, isLive, taskCredits } from "@/lib/catalog";
import { field, jsonUpTo } from "@/lib/forms";
import { githubToken, parseRepo, pushToGithub } from "@/lib/github";
import { account, chargeExtra, release, spend } from "@/lib/ledger";
import { SAY, spendMessage } from "@/lib/messages";
import { signedInUserId } from "@/lib/session";

/*
 * One Builder step. The person's message (if any) is added to the conversation, Claude replies or
 * edits files, the edits are applied, and everything is saved in order. The app calls this again
 * until Claude says it's done (or the person presses Stop), so each request stays short, every
 * step shows its own cost, and nothing runs after the person leaves.
 */

const ERRORS = {
  busy: `${SAY.busy} ${SAY.refunded}`,
  failed: `We couldn't finish that step. Please try again. ${SAY.refunded}`,
  unavailable: `That model isn't available right now. Pick another one and try again. ${SAY.refunded}`,
  aborted: "Stopped.",
} as const;

type Block = { type: string; id?: string; name?: string; input?: unknown };

export async function POST(req: Request, ctx: RouteContext<"/api/build/[id]/step">) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  const blocked = await blockedReason(userId, "spend").catch(() => null);
  if (blocked) return Response.json({ error: blocked }, { status: 403 });
  const id = Number((await ctx.params).id);
  const data = await jsonUpTo(req, 40_000);
  if (!Number.isSafeInteger(id) || !data) return Response.json({ error: SAY.badRequest }, { status: 400 });
  const message = typeof data.message === "string" ? data.message.trim().slice(0, 12_000) : "";
  const jobId = field(data, "jobId", 64);
  // The repository this project saves to (remembered in the person's browser), for save_to_github.
  const repoSetting = field(data, "repo", 200);
  const model = MODELS.find((m) => m.id === data.modelId);
  if (!/^[\w-]{8,64}$/.test(jobId) || !model) return Response.json({ error: SAY.badRequest }, { status: 400 });
  const onGemini = model.provider === "google";
  if ((!isClaudeModel(model.id) && !onGemini) || !isLive(model, providers())) return Response.json({ error: "The Builder works with Gemini Flash and the Claude models (Haiku, Sonnet, Opus). Pick one of those." }, { status: 400 });

  const d = db();
  const project = await ownBuild(id, userId).catch(() => null);
  if (!project) return Response.json({ error: SAY.notFound }, { status: 404 });

  // The conversation so far. A step cut off between saving the AI's edits and their results
  // would leave edits with no results, which the model refuses to continue from, so those are
  // closed as interrupted first. Then the new message goes at the end.
  let steps = await loadSteps(id);
  const tail = steps[steps.length - 1];
  const orphans = tail?.role === "assistant" ? ((Array.isArray(tail.content) ? tail.content : []) as Block[]).filter((b) => b.type === "tool_use" && b.id) : [];
  if (orphans.length)
    await d.insert(schema.buildSteps).values({
      projectId: id,
      role: "user",
      content: orphans.map((b) => ({ type: "tool_result", tool_use_id: b.id, is_error: true, content: "This edit was interrupted and may not have been applied. View the file to check." })),
    });
  if (message) await d.insert(schema.buildSteps).values({ projectId: id, role: "user", content: [{ type: "text", text: message }] });
  if (orphans.length || message) steps = await loadSteps(id);
  const last = steps[steps.length - 1];
  if (!last || last.role !== "user") return Response.json({ done: true });
  const history = JSON.stringify(steps.map((s) => s.content));
  if (history.length > MAX_HISTORY_CHARS)
    return Response.json({ error: "This project's conversation has grown too long to continue. Start a new thread from the menu; your files stay as they are." }, { status: 413 });

  // The step's starting price; the real cost is settled when it ends.
  const price = model.credits;
  const ref = `build:${userId}:${jobId}`;
  const paid = await spend(userId, price, ref, `Builder · ${model.name}`).catch(() => null);
  if (!paid || !paid.ok) {
    const acct = await account(userId).catch(() => null);
    const reason = paid?.reason ?? "failed";
    return Response.json({ error: spendMessage(reason), reason, ...(acct ?? {}) }, { status: reason === "credits" ? 402 : reason === "duplicate" ? 409 : 429 });
  }

  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: object) => {
        try {
          controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
        } catch {}
      };
      send({ type: "start", price });
      // What this step has taken so far, and whether its result is saved: anything that fails
      // before the save is refunded in full, extra charge included.
      let charged = price;
      let saved = false;
      try {
        const history = steps.map((s) => ({ role: s.role, content: s.content as Anthropic.Beta.BetaContentBlockParam[] }));
        const onText = (text: string) => send({ type: "text", text });
        const { message: reply, inputTokens, outputTokens } = onGemini
          ? await geminiBuildStep({ system: BUILD_SYSTEM, messages: history, signal: req.signal, onText })
          : await claudeBuildStep({ modelId: model.id, system: BUILD_SYSTEM, messages: history, signal: req.signal, onText });
        const uses = (reply.content as Block[]).filter((b) => b.type === "tool_use");
        const actual = taskCredits(price, model, inputTokens, outputTokens, Math.ceil(replyCostUsd(model.id, inputTokens, outputTokens) / ESTIMATE.usdPerCredit));
        if (actual > price) charged += await chargeExtra(userId, actual - price, `${ref}:extra`, `Builder · ${model.name} · bigger step`);
        // Nothing at all came back (even after Gemini's retry): don't charge for it, and say so.
        if (!reply.content.length) {
          await release(userId, charged, ref).catch(() => {});
          saved = true;
          send({ type: "error", message: `The model didn't answer this time. Press Continue to try again, or pick another model. ${SAY.refunded}`, ...(await account(userId)) });
          return;
        }
        if (reply.stop_reason === "refusal") {
          await release(userId, charged, ref).catch(() => {});
          saved = true;
          send({ type: "error", message: `The model chose not to do that one. Try asking a different way. ${SAY.refunded}`, ...(await account(userId)) });
          return;
        }
        // A reply cut off mid-edit can't be applied safely, and its half-written edit can't stay
        // in the conversation; the person is asked for a smaller step instead. The tokens were
        // really used, so the step is still paid.
        if (reply.stop_reason === "max_tokens" && uses.length) {
          saved = true;
          send({ type: "error", message: "That step tried to write too much at once. Ask for a smaller part of the change.", charged, ...(await account(userId)) });
          return;
        }
        // Edits first, then the reply and its results saved together, so the conversation never
        // holds edits without their results.
        const changed: string[] = [];
        const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
        if (uses.length) {
          const files = await loadFiles(id);
          for (const u of uses) {
            const input = (u.input && typeof u.input === "object" ? u.input : {}) as Record<string, unknown>;
            if (u.name === "save_to_github") {
              const out = await commitToGithub(userId, repoSetting, files, String(input.message ?? "").slice(0, 200) || "Update from Wanlly");
              send({ type: "github", ok: !out.error, url: out.url, need: out.need, message: out.text });
              send({ type: "edit", command: "github", path: String(input.message ?? ""), ok: !out.error });
              results.push({ type: "tool_result", tool_use_id: u.id!, content: out.text, ...(out.error ? { is_error: true } : {}) });
              continue;
            }
            const out = await runEditor(id, files, input).catch(() => ({ text: "That edit couldn't be saved. Try again.", error: true, changed: undefined }));
            if (out.changed && !changed.includes(out.changed)) changed.push(out.changed);
            send({ type: "edit", command: String(input.command ?? ""), path: String(input.path ?? ""), ok: !out.error });
            results.push({ type: "tool_result", tool_use_id: u.id!, content: out.text, ...(out.error ? { is_error: true } : {}) });
          }
        }
        const reply$ = d.insert(schema.buildSteps).values({ projectId: id, role: "assistant", content: reply.content, modelId: model.id, inputTokens, outputTokens, credits: charged });
        const touched = d.update(schema.projects).set({ updatedAt: sql`now()` }).where(eq(schema.projects.id, id));
        if (results.length) await d.batch([reply$, d.insert(schema.buildSteps).values({ projectId: id, role: "user", content: results }), touched]);
        else await d.batch([reply$, touched]);
        saved = true;
        send({ type: "done", done: !uses.length, stop: reply.stop_reason, charged, changed, ...(await account(userId)) });
      } catch (e) {
        const kind = errorKind(e);
        if (kind !== "aborted") console.error("build step failed", kind, errorDetail(e));
        // Nothing of this step was kept, so nothing of it is paid.
        if (!saved) await release(userId, charged, ref).catch(() => {});
        send({ type: "error", message: kind === "aborted" ? `Stopped. ${SAY.refunded}` : ERRORS[kind], ...(await account(userId).catch(() => ({}))) });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}

/** The AI's save_to_github: commits the project's files to the linked repository. */
async function commitToGithub(userId: string, repo: string, files: Map<string, string>, message: string): Promise<{ text: string; error?: boolean; url?: string; need?: "connect" | "repo" }> {
  const { token } = await githubToken(userId);
  if (!token) return { text: "GitHub isn't connected for this person yet. The app has opened its GitHub panel for them to connect; ask them to say push again after.", error: true, need: "connect" };
  const target = repo ? parseRepo(repo) : null;
  if (!target) return { text: "No repository is linked to this project yet. The app has opened its GitHub panel for them to pick or paste one; ask them to say push again after.", error: true, need: "repo" };
  if (!files.size) return { text: "There are no files to commit yet.", error: true };
  try {
    const url = await pushToGithub(token, target, [...files].map(([path, content]) => ({ path, content })), message);
    return { text: `Committed "${message}" and pushed to ${url}.`, url };
  } catch (e) {
    return { text: e instanceof Error ? e.message : "GitHub didn't accept the commit.", error: true };
  }
}
