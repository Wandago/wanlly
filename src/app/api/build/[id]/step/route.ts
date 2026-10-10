import type Anthropic from "@anthropic-ai/sdk";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { blockedReason } from "@/lib/admin";
import { claudeBuildStep, errorDetail, errorKind, isClaudeModel, providers, replyCostUsd } from "@/lib/ai";
import { BUILD_SYSTEM, MAX_HISTORY_CHARS, loadFiles, loadSteps, ownBuild, runEditor } from "@/lib/build";
import { ESTIMATE, MODELS, isLive, taskCredits } from "@/lib/catalog";
import { field, jsonUpTo } from "@/lib/forms";
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
  unavailable: `The Builder needs a Claude model that's live right now. Pick another one and try again. ${SAY.refunded}`,
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
  const model = MODELS.find((m) => m.id === data.modelId);
  if (!/^[\w-]{8,64}$/.test(jobId) || !model) return Response.json({ error: SAY.badRequest }, { status: 400 });
  if (!isClaudeModel(model.id) || !isLive(model, providers())) return Response.json({ error: "The Builder works with Claude models (Haiku, Sonnet or Opus). Pick one of those." }, { status: 400 });

  const d = db();
  const project = await ownBuild(id, userId).catch(() => null);
  if (!project) return Response.json({ error: SAY.notFound }, { status: 404 });

  // The conversation so far, with the new message at the end.
  let steps = await loadSteps(id);
  if (message) {
    await d.insert(schema.buildSteps).values({ projectId: id, role: "user", content: [{ type: "text", text: message }] });
    steps = await loadSteps(id);
  }
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
      let streamed = false;
      try {
        const { message: reply, inputTokens, outputTokens } = await claudeBuildStep({
          modelId: model.id,
          system: BUILD_SYSTEM,
          messages: steps.map((s) => ({ role: s.role, content: s.content as Anthropic.Beta.BetaContentBlockParam[] })),
          signal: req.signal,
          onText: (text) => {
            streamed = true;
            send({ type: "text", text });
          },
        });
        const uses = (reply.content as Block[]).filter((b) => b.type === "tool_use");
        const actual = taskCredits(price, model, inputTokens, outputTokens, Math.ceil(replyCostUsd(model.id, inputTokens, outputTokens) / ESTIMATE.usdPerCredit));
        const extra = actual > price ? await chargeExtra(userId, actual - price, `${ref}:extra`, `Builder · ${model.name} · bigger step`) : 0;
        const charged = price + extra;
        if (reply.stop_reason === "refusal") {
          await release(userId, charged, ref).catch(() => {});
          send({ type: "error", message: `The model chose not to do that one. Try asking a different way. ${SAY.refunded}`, ...(await account(userId)) });
          return;
        }
        // A reply cut off mid-edit can't be applied safely, and its half-written edit can't stay
        // in the conversation; the person is asked for a smaller step instead.
        if (reply.stop_reason === "max_tokens" && uses.length) {
          send({ type: "error", message: "That step tried to write too much at once. Ask for a smaller part of the change.", charged, ...(await account(userId)) });
          return;
        }
        await d.insert(schema.buildSteps).values({ projectId: id, role: "assistant", content: reply.content, modelId: model.id, inputTokens, outputTokens, credits: charged });
        const changed: string[] = [];
        if (uses.length) {
          const files = await loadFiles(id);
          const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
          for (const u of uses) {
            const input = (u.input && typeof u.input === "object" ? u.input : {}) as Record<string, unknown>;
            const out = await runEditor(id, files, input).catch(() => ({ text: "That edit couldn't be saved. Try again.", error: true, changed: undefined }));
            if (out.changed && !changed.includes(out.changed)) changed.push(out.changed);
            send({ type: "edit", command: String(input.command ?? ""), path: String(input.path ?? ""), ok: !out.error });
            results.push({ type: "tool_result", tool_use_id: u.id!, content: out.text, ...(out.error ? { is_error: true } : {}) });
          }
          await d.insert(schema.buildSteps).values({ projectId: id, role: "user", content: results });
        }
        await d.update(schema.projects).set({ updatedAt: sql`now()` }).where(eq(schema.projects.id, id));
        send({ type: "done", done: !uses.length, stop: reply.stop_reason, charged, changed, ...(await account(userId)) });
      } catch (e) {
        const kind = errorKind(e);
        if (kind !== "aborted") console.error("build step failed", kind, errorDetail(e));
        // Nothing arrived: the price goes back. Stopped part-way: the work done is kept and paid.
        if (!streamed) await release(userId, price, ref).catch(() => {});
        send({ type: "error", message: streamed && kind === "aborted" ? "Stopped." : ERRORS[kind], ...(await account(userId).catch(() => ({}))) });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
