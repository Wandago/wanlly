import { blockedReason } from "@/lib/admin";
import { claudeSandboxCheck, errorDetail, errorKind, isClaudeModel, providers, replyCostUsd } from "@/lib/ai";
import { loadFiles, ownBuild } from "@/lib/build";
import { ESTIMATE, MODELS, isLive, taskCredits } from "@/lib/catalog";
import { field, smallJson } from "@/lib/forms";
import { account, chargeExtra, release, spend } from "@/lib/ledger";
import { SAY, spendMessage } from "@/lib/messages";
import { zipFiles } from "@/lib/runnable";
import { signedInUserId } from "@/lib/session";

/**
 * "Run checks": the project's files run in Anthropic's code sandbox, where the AI installs what
 * it can, runs the build and tests, and reports what failed. Nothing is changed; the report can
 * then go to the Builder to fix. Charged like a step: a starting price, then what it really used.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/build/[id]/check">) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: SAY.signedOut }, { status: 401 });
  const blocked = await blockedReason(userId, "spend").catch(() => null);
  if (blocked) return Response.json({ error: blocked }, { status: 403 });
  const id = Number((await ctx.params).id);
  const data = await smallJson(req);
  const jobId = data ? field(data, "jobId", 64) : "";
  if (!Number.isSafeInteger(id) || !/^[\w-]{8,64}$/.test(jobId)) return Response.json({ error: SAY.badRequest }, { status: 400 });
  if (!(await ownBuild(id, userId).catch(() => null))) return Response.json({ error: SAY.notFound }, { status: 404 });
  // Checks run on Sonnet: careful enough to read build output, and half Opus's price.
  const model = MODELS.find((m) => m.id === "sonnet");
  if (!model || !isClaudeModel(model.id) || !isLive(model, providers())) return Response.json({ error: "Checks need Claude Sonnet, which isn't switched on yet." }, { status: 400 });
  const files = [...(await loadFiles(id))].map(([name, code]) => ({ name, code }));
  if (!files.length) return Response.json({ error: "There are no files to check yet." }, { status: 400 });

  const price = model.credits * 2;
  const ref = `check:${userId}:${jobId}`;
  const paid = await spend(userId, price, ref, "Builder · run checks").catch(() => null);
  if (!paid || !paid.ok) {
    const acct = await account(userId).catch(() => null);
    return Response.json({ error: spendMessage(paid?.reason ?? "failed"), ...(acct ?? {}) }, { status: 402 });
  }
  try {
    const { report, inputTokens, outputTokens } = await claudeSandboxCheck({ modelId: model.id, zip: zipFiles(files), signal: req.signal });
    const actual = taskCredits(price, model, inputTokens, outputTokens, Math.ceil(replyCostUsd(model.id, inputTokens, outputTokens) / ESTIMATE.usdPerCredit));
    const extra = actual > price ? await chargeExtra(userId, actual - price, `${ref}:extra`, "Builder · run checks · longer") : 0;
    return Response.json({ report: report || "The checks finished without a report.", charged: price + extra, ...(await account(userId)) });
  } catch (e) {
    console.error("build check failed", errorKind(e), errorDetail(e));
    await release(userId, price, ref).catch(() => {});
    return Response.json({ error: `${errorKind(e) === "busy" ? SAY.busy : "The checks couldn't run just now. Please try again."} ${SAY.refunded}`, ...(await account(userId).catch(() => ({}))) }, { status: 503 });
  }
}
