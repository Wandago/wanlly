import { blockedReason } from "@/lib/admin";
import { TOOLS, MODELS, jobCost, type ToolId } from "@/lib/catalog";
import { smallJson, field } from "@/lib/forms";
import { account, spend } from "@/lib/ledger";
import { signedInUserId } from "@/lib/session";

/** Models people can spend on today. GPT and Grok are listed as coming soon. */
const LIVE = new Set(["haiku", "sonnet", "opus", "fable", "gemini-flash"]);

const ERRORS = {
  credits: "Not enough credits",
  day: "You've reached today's limit",
  week: "You've reached this week's limit",
  duplicate: "That job was already charged",
} as const;

/** Charges for one job. The price comes from the catalog here, never from the browser. */
export async function POST(req: Request) {
  const userId = await signedInUserId(req);
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const blocked = await blockedReason(userId, "spend").catch(() => null);
  if (blocked) return Response.json({ error: blocked }, { status: 403 });
  const data = await smallJson(req);
  if (!data) return Response.json({ error: "Bad request" }, { status: 400 });
  const toolId = field(data, "tool", 20) as ToolId;
  const modelId = field(data, "modelId", 40);
  const jobId = field(data, "jobId", 64);
  const tool = Object.hasOwn(TOOLS, toolId) ? TOOLS[toolId] : undefined;
  const model = MODELS.find((m) => m.id === modelId);
  if (!tool || !model || !LIVE.has(model.id) || !/^[\w-]{8,64}$/.test(jobId)) return Response.json({ error: "Bad request" }, { status: 400 });

  const price = jobCost(tool, model);
  try {
    const r = await spend(userId, price, `job:${userId}:${jobId}`, `${tool.label} · ${model.name}`);
    const acct = await account(userId);
    if (r.ok) return Response.json({ ok: true, price, ...acct });
    const status = r.reason === "credits" ? 402 : r.reason === "duplicate" ? 409 : 429;
    return Response.json({ error: ERRORS[r.reason], reason: r.reason, price, ...acct }, { status });
  } catch (e) {
    console.error("spend failed", e);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
